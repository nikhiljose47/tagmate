import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { DirectMessage, LocalNotification, Tag, ThreadedComment } from '../models/tag.model';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { LoggerService } from './logger.service';
import { ToastService } from './toast.service';
import {
  PostCommentRow,
  rowToComment,
  DirectMessageRow,
  rowToDirectMessage,
  NotificationRow,
  rowToNotification,
  notificationToRow,
} from './social.mapper';

export type LocalComment = ThreadedComment;

interface LikeRow { post_id: string; user_id: string; }
interface RsvpRow { post_id: string; user_id: string; }
interface PollVoteRow { post_id: string; option_index: number; user_id: string; }
interface OwnershipRow { post_id: string; }

/**
 * Supabase-backed social interactions. Every public method here keeps its
 * exact original signature so every calling component stays untouched — only
 * the internals moved from localStorage to Postgres. See the migration plan
 * (persist-social-interactions) for the full design rationale.
 */
@Injectable({ providedIn: 'root' })
export class SocialInteractionsService {
  private readonly likedKey = 'tagmate.likedPosts';
  private readonly savedKey = 'tagmate.savedPosts';
  private readonly commentsKey = 'tagmate.comments';
  private readonly hiddenKey = 'tagmate.hiddenPosts';
  private readonly reportedKey = 'tagmate.reportedPosts';
  private readonly rsvpsKey = 'tagmate.rsvps';
  private readonly messagesKey = 'tagmate.messages';
  private readonly notificationsKey = 'tagmate.notifications';
  private readonly reputationKey = 'tagmate.reputation';
  private readonly questsKey = 'tagmate.completedQuests';

  readonly likedPosts = signal(new Set<string>());
  readonly savedPosts = signal(new Set<string>());
  readonly hiddenPosts = signal(new Set<string>());
  readonly reportedPosts = signal(new Set<string>());
  readonly rsvps = signal(new Set<string>());
  readonly comments = signal<Record<string, LocalComment[]>>({});
  readonly messages = signal<Record<string, DirectMessage[]>>({});
  readonly notifications = signal<LocalNotification[]>([]);
  readonly pollVotes = signal<Record<string, Record<string, string[]>>>({});
  readonly completedQuests = signal(new Set<string>());

  constructor() {
    this.likedPosts.set(new Set(this.readJson<string[]>(this.likedKey, [])));
    this.savedPosts.set(new Set(this.readJson<string[]>(this.savedKey, [])));
    this.hiddenPosts.set(new Set(this.readJson<string[]>(this.hiddenKey, [])));
    this.reportedPosts.set(new Set(this.readJson<string[]>(this.reportedKey, [])));
    this.comments.set(this.readJson<Record<string, LocalComment[]>>(this.commentsKey, {}));
    this.rsvps.set(this.readJson<Record<string, string[]>>(this.rsvpsKey, {}));
    this.messages.set(this.readJson<Record<string, DirectMessage[]>>(this.messagesKey, {}));
    this.notifications.set(this.readJson<LocalNotification[]>(this.notificationsKey, []));
    this.reputation.set(this.readJson<Record<string, number>>(this.reputationKey, {}));
    this.pollVotes.set(this.readJson<Record<string, Record<string, string[]>>>('tagmate.pollVotes', {}));
    this.completedQuests.set(new Set(this.readJson<string[]>(this.questsKey, [])));
  }

  postKey(post: Tag): string {
    return post.id ?? `${post.userId}-${post.createdAt}`;
  }

  // ---------- LIKES ----------

  isLiked(post: Tag): boolean {
    const key = this.postKey(post);
    this.requestViewerState(key);
    return this.likedPosts().has(key);
  }

  likeCount(post: Tag): number {
    const key = this.postKey(post);
    return Math.max(0, (post.likeCount ?? 0) + (this.likeDeltas()[key] ?? 0));
  }

  toggleLike(post: Tag): boolean {
    const key = this.postKey(post);
    const uid = this.currentUid();
    if (!uid) { this.warnSignInRequired('like'); return this.likedPosts().has(key); }

    const wasLiked = this.likedPosts().has(key);
    const nowLiked = !wasLiked;
    this.toggleInSet(this.likedPosts, key, nowLiked);
    this.bumpDelta(this.likeDeltas, key, nowLiked ? 1 : -1);

    const write$ = nowLiked
      ? this.supabase.addRow('post_likes', { post_id: post.id, user_id: uid })
      : this.supabase.deleteRowsWhere('post_likes', { post_id: post.id, user_id: uid });

    void this.fireAndForget(write$, (err) => {
      this.logger.error('toggleLike failed, rolling back', err);
      this.toggleInSet(this.likedPosts, key, wasLiked);
      this.bumpDelta(this.likeDeltas, key, wasLiked ? 1 : -1);
      this.toast.show('Could not update like — please try again.', 'danger');
    });

    return nowLiked;
  }

  // ---------- SAVES / HIDDEN ----------

  isSaved(post: Tag): boolean {
    return this.savedPosts().has(this.postKey(post));
  }

  isHidden(post: Tag): boolean {
    return this.hiddenPosts().has(this.postKey(post));
  }

  toggleSave(post: Tag): boolean {
    const key = this.postKey(post);
    const uid = this.currentUid();
    if (!uid) { this.warnSignInRequired('save'); return this.savedPosts().has(key); }

    const wasSaved = this.savedPosts().has(key);
    const nowSaved = !wasSaved;
    this.toggleInSet(this.savedPosts, key, nowSaved);

    const write$ = nowSaved
      ? this.supabase.addRow('user_saved_posts', { user_id: uid, post_id: post.id })
      : this.supabase.deleteRowsWhere('user_saved_posts', { user_id: uid, post_id: post.id });

    void this.fireAndForget(write$, (err) => {
      this.logger.error('toggleSave failed, rolling back', err);
      this.toggleInSet(this.savedPosts, key, wasSaved);
      this.toast.show('Could not update saved posts — please try again.', 'danger');
    });

    return nowSaved;
  }

  reportPost(post: Tag): void {
    const key = this.postKey(post);
    const uid = this.currentUid();
    this.addToSetLocal(this.hiddenPosts, key);
    this.addToSetLocal(this.reportedPosts, key);
    if (!uid) return;

    void this.fireAndForget(
      this.supabase.addRow('post_reports', { post_id: post.id, reporter_id: uid }),
      (err) => this.logger.error('reportPost: report insert failed', err)
    );
    void this.fireAndForget(
      this.supabase.addRow('user_hidden_posts', { user_id: uid, post_id: post.id }),
      (err) => this.logger.error('reportPost: hide insert failed', err)
    );
  }

  // ---------- COMMENTS ----------

  commentCount(post: Tag): number {
    const key = this.postKey(post);
    return Math.max(0, (post.commentCount ?? 0) + (this.commentDeltas()[key] ?? 0));
  }

  commentsFor(post: Tag): LocalComment[] {
    this.ensureCommentsHydrated(post);
    return this.comments()[this.postKey(post)] ?? [];
  }

  topLevelCommentsFor(post: Tag): LocalComment[] {
    return this.commentsFor(post).filter((comment) => !comment.parentId);
  }

  repliesFor(post: Tag, parentId: string): LocalComment[] {
    return this.commentsFor(post).filter((comment) => comment.parentId === parentId);
  }

  toggleLike(post: Tag): boolean {
    const liked = this.toggleSet(this.likedPosts, this.postKey(post), this.likedKey);
    this.bumpReputation(post.username, liked ? 2 : -2);
    if (liked) {
      this.addNotification('love', 'New love', `${post.username || 'A neighbor'} got love on a post.`, this.postKey(post));
      this.completeQuest('love');
    }
    return liked;
  }

  toggleSave(post: Tag): boolean {
    return this.toggleSet(this.savedPosts, this.postKey(post), this.savedKey);
  }

  addComment(post: Tag, text: string, author = 'You', parentId?: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    const uid = this.currentUid();
    if (!uid) { this.warnSignInRequired('comment'); return; }

    const key = this.postKey(post);
    const mentions = Array.from(trimmed.matchAll(/@([a-z0-9_.-]+)/gi)).map((m) => m[1]);
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticComment: LocalComment = {
      id: optimisticId,
      postId: key,
      author,
      text: trimmed,
      createdAt: new Date().toISOString(),
      upvotes: 0,
      mentions,
      parentId,
    };

    this.comments.update((current) => {
      const next = { ...current, [key]: [...(current[key] ?? []), comment] };
      this.writeJson(this.commentsKey, next);
      return next;
    });

    if (author === 'You' || author === 'Guest User') {
      this.completeQuest('comment');
    }

    this.pushLocalNotification(
      parentId ? 'reply' : 'reply',
      parentId ? 'New reply' : 'New comment',
      `${author} commented on ${post.highlight || 'a nearby tag'}.`,
      key
    );
  }

  upvoteComment(post: Tag, commentId: string): void {
    const key = this.postKey(post);
    this.bumpCommentUpvote(key, commentId, 1);
    void this.fireAndForget(this.supabase.incrementCommentUpvote(commentId), (err) => {
      this.logger.error('upvoteComment failed, rolling back', err);
      this.bumpCommentUpvote(key, commentId, -1);
    });
  }

  /** Known limitation carried over unchanged: no per-user dedup, same as before ("just increment"). */
  toggleLoveComment(postKey: string, commentId: string): void {
    this.bumpCommentUpvote(postKey, commentId, 1);
    void this.fireAndForget(
      this.supabase.incrementCommentUpvote(commentId),
      (err) => this.logger.error('toggleLoveComment failed', err)
    );
  }

  // ---------- POLLS ----------
  // NB: `postKey` here is a string (callers already resolve it via postKey(post))
  // and the `username` parameter is ignored — every caller today passes a
  // placeholder ('Guest User') because there was no real auth when this was
  // written; the actual current session's uid is used instead.

  getPollVotes(postKey: string): Record<string, string[]> {
    this.ensurePollHydrated(postKey);
    return this.pollVotes()[postKey] ?? {};
  }

  votePoll(postKey: string, optionIndex: number, username: string): void {
    const current = { ...this.pollVotes() };
    if (!current[postKey]) {
      current[postKey] = {};
    }
    
    // Remove user's previous votes on this poll
    for (const key of Object.keys(current[postKey])) {
      current[postKey][key] = current[postKey][key].filter(u => u !== username);
    }
    
    // Add vote
    const optKey = optionIndex.toString();
    if (!current[postKey][optKey]) {
      current[postKey][optKey] = [];
    }
    current[postKey][optKey].push(username);
    
    this.pollVotes.set(current);
    this.writeJson('tagmate.pollVotes', current);

    if (username === 'You' || username === 'Guest User') {
      this.completeQuest('poll');
    }
  }

  hasVotedPoll(postKey: string, optionIndex: number, _username: string): boolean {
    this.ensurePollHydrated(postKey);
    const uid = this.currentUid();
    if (!uid) return false;
    const votes = this.getPollVotes(postKey);
    return !!votes[optionIndex.toString()]?.includes(uid);
  }

  totalPollVotes(postKey: string): number {
    return Object.values(this.getPollVotes(postKey)).reduce((sum, arr) => sum + arr.length, 0);
  }

  // ---------- RSVPs ----------
  // `user` parameter is ignored for the same reason as polls above — always
  // resolves to the current session.

  rsvpCount(post: Tag): number {
    const key = this.postKey(post);
    return Math.max(0, (post.rsvpCount ?? 0) + (this.rsvpDeltas()[key] ?? 0));
  }

  isRsvped(post: Tag, _user = 'You'): boolean {
    const key = this.postKey(post);
    this.requestViewerState(key);
    return this.rsvps().has(key);
  }

  toggleRsvp(post: Tag, _user = 'You'): boolean {
    const key = this.postKey(post);
    const uid = this.currentUid();
    if (!uid) { this.warnSignInRequired('RSVP'); return this.rsvps().has(key); }

    const wasAttending = this.rsvps().has(key);
    const nowAttending = !wasAttending;
    this.toggleInSet(this.rsvps, key, nowAttending);
    this.bumpDelta(this.rsvpDeltas, key, nowAttending ? 1 : -1);

    const write$ = nowAttending
      ? this.supabase.addRow('post_rsvps', { post_id: post.id, user_id: uid })
      : this.supabase.deleteRowsWhere('post_rsvps', { post_id: post.id, user_id: uid });

    void this.fireAndForget(write$, (err) => {
      this.logger.error('toggleRsvp failed, rolling back', err);
      this.toggleInSet(this.rsvps, key, wasAttending);
      this.bumpDelta(this.rsvpDeltas, key, wasAttending ? 1 : -1);
      this.toast.show('Could not update RSVP — please try again.', 'danger');
    });
    if (attending) {
      this.addNotification('rsvp', 'RSVP saved', `You are attending ${post.highlight || 'this event'}.`, key);
      if (user === 'You' || user === 'Guest User') {
        this.completeQuest('rsvp');
      }
    }
    return attending;
  }

  // ---------- DIRECT MESSAGES ----------

  sendMessage(post: Tag, text: string, from = 'You'): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    const uid = this.currentUid();
    if (!uid) { this.warnSignInRequired('message'); return; }
    if (!post.userId) { this.logger.warn('sendMessage: post has no userId, cannot address recipient'); return; }

    const postId = this.postKey(post);
    const threadId = `${postId}:${post.userId}`;
    const toName = post.username || 'Neighbor';
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: DirectMessage = {
      id: optimisticId,
      threadId,
      postId,
      from,
      to: toName,
      text: trimmed,
      createdAt: new Date().toISOString(),
      read: false,
    };
    this.messages.update((m) => ({ ...m, [threadId]: [...(m[threadId] ?? []), optimisticMessage] }));

    const row = {
      thread_id: threadId,
      post_id: post.id ?? null,
      from_uid: uid,
      to_uid: post.userId,
      to_name: toName,
      text: trimmed,
      read: false,
    };

    firstValueFrom(this.supabase.addRow('direct_messages', row))
      .then(({ error }) => { if (error) throw error; })
      .catch((err) => {
        this.logger.error('sendMessage failed, rolling back', err);
        this.messages.update((m) => ({
          ...m,
          [threadId]: (m[threadId] ?? []).filter((msg) => msg.id !== optimisticId),
        }));
        this.toast.show('Could not send your message — please try again.', 'danger');
      });

    this.pushLocalNotification('message', 'Message sent', `Private message sent to ${toName}.`, postId);
  }

  threadFor(post: Tag): DirectMessage[] {
    const threadId = `${this.postKey(post)}:${post.userId || post.username || 'author'}`;
    this.ensureThreadHydrated(threadId);
    return this.messages()[threadId] ?? [];
  }

  // ---------- NOTIFICATIONS ----------

  unreadNotifications(): number {
    return this.notifications().filter((notification) => !notification.read).length;
  }

  addNotification(
    type: LocalNotification['type'],
    title: string,
    body: string,
    postId?: string
  ): void {
    this.pushLocalNotification(type, title, body, postId);
  }

  requestPushPermission(): void {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
    void Notification.requestPermission();
  }

  // ---------- REPUTATION ----------
  // Trigger-maintained server-side (bumped by likes on a user's posts) — the
  // client never writes this directly, only reads it, keyed by uid.

  trustScore(uid: string): number {
    if (!uid) return 0;
    const cache = this.reputationCache();
    if (!(uid in cache) && !this.hydratingReputation.has(uid)) {
      this.hydratingReputation.add(uid);
      this.supabase.getUserById(uid).subscribe({
        next: (user) => this.reputationCache.update((c) => ({ ...c, [uid]: user?.reputation ?? 0 })),
        error: (err) => {
          this.logger.warn('trustScore hydrate failed', err);
          this.reputationCache.update((c) => ({ ...c, [uid]: 0 }));
        },
      });
    }
    return this.reputationCache()[uid] ?? 0;
  }

  trustBadge(uid: string): string {
    const score = this.trustScore(uid);
    if (score >= 50) return 'Trusted';
    if (score >= 20) return 'Helpful';
    if (score >= 8) return 'Rising';
    return 'New';
  }

  // ---------- private: hydration ----------

  private hydratePersonalData(uid: string): void {
    this.supabase.getRows<OwnershipRow>('user_saved_posts', { field: 'user_id', op: '==', value: uid })
      .subscribe(({ data, error }) => {
        if (error) { this.logger.warn('saved posts hydrate failed', error); return; }
        this.savedPosts.set(new Set((data ?? []).map((r) => r.post_id)));
      });

    this.supabase.getRows<OwnershipRow>('user_hidden_posts', { field: 'user_id', op: '==', value: uid })
      .subscribe(({ data, error }) => {
        if (error) { this.logger.warn('hidden posts hydrate failed', error); return; }
        this.hiddenPosts.set(new Set((data ?? []).map((r) => r.post_id)));
      });

    this.supabase.getLatest<NotificationRow>('notifications', 25)
      .subscribe(({ data, error }) => {
        if (error) { this.logger.warn('notifications hydrate failed', error); return; }
        this.notifications.set((data ?? []).map(rowToNotification));
      });
  }

  private resetPersonalSignals(): void {
    this.savedPosts.set(new Set());
    this.hiddenPosts.set(new Set());
    this.reportedPosts.set(new Set());
    this.notifications.set([]);
    this.likedPosts.set(new Set());
    this.rsvps.set(new Set());
    this.pollVotes.set({});
    this.comments.set({});
    this.messages.set({});
    this.likeDeltas.set({});
    this.commentDeltas.set({});
    this.rsvpDeltas.set({});
    this.hydratedLikeRsvp.clear();
    this.hydratingComments.clear();
    this.hydratingPoll.clear();
    this.hydratingThreads.clear();
  }

  /** Coalesces isLiked/isRsvped requests across a whole render pass into one batched query per table. */
  private requestViewerState(postKey: string): void {
    if (this.hydratedLikeRsvp.has(postKey) || this.pendingBatchIds.has(postKey)) return;
    this.pendingBatchIds.add(postKey);
    if (!this.batchScheduled) {
      this.batchScheduled = true;
      queueMicrotask(() => this.flushViewerStateBatch());
    }
  }

  private flushViewerStateBatch(): void {
    this.batchScheduled = false;
    const ids = Array.from(this.pendingBatchIds);
    this.pendingBatchIds.clear();
    if (!ids.length) return;
    // Mark attempted regardless of outcome — avoids a retry-storm on a sustained backend error.
    ids.forEach((id) => this.hydratedLikeRsvp.add(id));

    const uid = this.currentUid();
    if (!uid) return;

    this.supabase.getRowsIn<LikeRow>('post_likes', 'post_id', ids).subscribe(({ data, error }) => {
      if (error) { this.logger.warn('like batch hydrate failed', error); return; }
      const mine = (data ?? []).filter((r) => r.user_id === uid).map((r) => r.post_id);
      if (mine.length) this.likedPosts.update((s) => new Set([...s, ...mine]));
    });

    this.supabase.getRowsIn<RsvpRow>('post_rsvps', 'post_id', ids).subscribe(({ data, error }) => {
      if (error) { this.logger.warn('rsvp batch hydrate failed', error); return; }
      const mine = (data ?? []).filter((r) => r.user_id === uid).map((r) => r.post_id);
      if (mine.length) this.rsvps.update((s) => new Set([...s, ...mine]));
    });
  }

  private ensureCommentsHydrated(post: Tag): void {
    const key = this.postKey(post);
    if (this.hydratingComments.has(key)) return;
    this.hydratingComments.add(key);
    this.supabase.getRows<PostCommentRow>('post_comments', { field: 'post_id', op: '==', value: key })
      .subscribe({
        next: ({ data, error }) => {
          if (error) { this.logger.warn('comments hydrate failed', error); return; }
          const mapped = (data ?? [])
            .map(rowToComment)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          this.comments.update((c) => ({ ...c, [key]: mapped }));
        },
        error: (err) => this.logger.warn('comments hydrate failed', err),
      });
  }

  private ensurePollHydrated(postKey: string): void {
    if (this.hydratingPoll.has(postKey)) return;
    this.hydratingPoll.add(postKey);
    this.supabase.getRows<PollVoteRow>('post_poll_votes', { field: 'post_id', op: '==', value: postKey })
      .subscribe({
        next: ({ data, error }) => {
          if (error) { this.logger.warn('poll hydrate failed', error); return; }
          const grouped: Record<string, string[]> = {};
          for (const row of data ?? []) {
            const k = row.option_index.toString();
            (grouped[k] ??= []).push(row.user_id);
          }
          this.pollVotes.update((v) => ({ ...v, [postKey]: grouped }));
        },
        error: (err) => this.logger.warn('poll hydrate failed', err),
      });
  }

  private ensureThreadHydrated(threadId: string): void {
    if (this.hydratingThreads.has(threadId)) return;
    this.hydratingThreads.add(threadId);
    this.supabase.getRows<DirectMessageRow>('direct_messages', { field: 'thread_id', op: '==', value: threadId })
      .subscribe({
        next: ({ data, error }) => {
          if (error) { this.logger.warn('thread hydrate failed', error); return; }
          const uid = this.currentUid();
          const mapped = (data ?? [])
            .map((r) => rowToDirectMessage(r, uid))
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          this.messages.update((m) => ({ ...m, [threadId]: mapped }));
        },
        error: (err) => this.logger.warn('thread hydrate failed', err),
      });
  }

  // ---------- private: realtime ----------

  private registerRealtime(): void {
    this.supabase.liveInserts<LikeRow>('post_likes').subscribe((row) => {
      if (row.user_id === this.currentUid() && this.hydratedLikeRsvp.has(row.post_id)) {
        this.likedPosts.update((s) => new Set([...s, row.post_id]));
      }
    });

    this.supabase.liveInserts<RsvpRow>('post_rsvps').subscribe((row) => {
      if (row.user_id === this.currentUid() && this.hydratedLikeRsvp.has(row.post_id)) {
        this.rsvps.update((s) => new Set([...s, row.post_id]));
      }
    });

    this.supabase.liveInserts<PostCommentRow>('post_comments').subscribe((row) => {
      if (!this.hydratingComments.has(row.post_id)) return;
      this.comments.update((c) => ({
        ...c,
        [row.post_id]: [...(c[row.post_id] ?? []).filter((cm) => cm.id !== row.id), rowToComment(row)]
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      }));
    });

    this.supabase.liveInserts<PollVoteRow>('post_poll_votes').subscribe((row) => {
      if (!this.hydratingPoll.has(row.post_id)) return;
      this.pollVotes.update((v) => {
        const forPost = { ...(v[row.post_id] ?? {}) };
        for (const k of Object.keys(forPost)) forPost[k] = forPost[k].filter((u) => u !== row.user_id);
        const optKey = row.option_index.toString();
        forPost[optKey] = [...(forPost[optKey] ?? []), row.user_id];
        return { ...v, [row.post_id]: forPost };
      });
    });

    this.supabase.liveInserts<DirectMessageRow>('direct_messages').subscribe((row) => {
      // RLS scopes delivery to thread participants only — no client-side filtering needed for privacy.
      if (!this.hydratingThreads.has(row.thread_id)) return;
      const uid = this.currentUid();
      this.messages.update((m) => ({
        ...m,
        [row.thread_id]: [...(m[row.thread_id] ?? []).filter((msg) => msg.id !== row.id), rowToDirectMessage(row, uid)]
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      }));
    });

    this.supabase.liveInserts<NotificationRow>('notifications').subscribe((row) => {
      // RLS scopes delivery to `user_id = auth.uid()` — already "mine only" over the wire.
      this.notifications.update((current) => [rowToNotification(row), ...current].slice(0, 25));
    });
  }

  // ---------- private: helpers ----------

  private applyVoteOptimistically(
    votes: Record<string, string[]>,
    optionIndex: number,
    uid: string
  ): Record<string, string[]> {
    const next: Record<string, string[]> = {};
    for (const [k, arr] of Object.entries(votes)) next[k] = arr.filter((v) => v !== uid);
    const optKey = optionIndex.toString();
    next[optKey] = [...(next[optKey] ?? []), uid];
    return next;
  }

  private bumpCommentUpvote(postKey: string, commentId: string, delta: number): void {
    this.comments.update((c) => ({
      ...c,
      [postKey]: (c[postKey] ?? []).map((cm) =>
        cm.id === commentId ? { ...cm, upvotes: Math.max(0, cm.upvotes + delta) } : cm
      ),
    }));
  }

  private pushLocalNotification(
    type: LocalNotification['type'],
    title: string,
    body: string,
    postId?: string
  ): void {
    const uid = this.currentUid();
    const notification: LocalNotification = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      title,
      body,
      postId,
      createdAt: new Date().toISOString(),
      read: false,
    };
    this.notifications.update((current) => [notification, ...current].slice(0, 25));

    if (uid) {
      void this.fireAndForget(
        this.supabase.addRow('notifications', notificationToRow(notification, uid)),
        (err) => this.logger.warn('addNotification: remote write failed (kept locally)', err)
      );
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }

  requestPushPermission(): void {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
    void Notification.requestPermission();
  }

  reportPost(post: Tag): void {
    const key = this.postKey(post);
    this.addToSet(this.reportedPosts, key, this.reportedKey);
    this.addToSet(this.hiddenPosts, key, this.hiddenKey);
  }

  private bumpReputation(username: string | undefined, delta: number): void {
    if (!username) return;
    this.reputation.update((current) => {
      const next = { ...current, [username]: Math.max(0, (current[username] ?? 0) + delta) };
      this.writeJson(this.reputationKey, next);
      return next;
    });
  }

  private toggleSet(
    setSignal: ReturnType<typeof signal<Set<string>>>,
    key: string,
    storageKey: string
  ): boolean {
    let hasKey = false;

    setSignal.update((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
        hasKey = false;
      } else {
        next.add(key);
        hasKey = true;
      }

      this.writeJson(storageKey, [...next]);
      return next;
    });

    return hasKey;
  }

  private addToSet(
    setSignal: ReturnType<typeof signal<Set<string>>>,
    key: string,
    storageKey: string
  ): void {
    setSignal.update((current) => {
      const next = new Set(current);
      next.add(key);
      this.writeJson(storageKey, [...next]);
      return next;
    });
  }

  private readJson<T>(key: string, fallback: T): T {
    try {
      if (typeof localStorage === 'undefined') return fallback;
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private writeJson<T>(key: string, value: T): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Local social state should never block the main posting flow.
    }
  }

  completeQuest(questId: string): boolean {
    let newlyCompleted = false;
    this.completedQuests.update((current) => {
      const next = new Set(current);
      if (!next.has(questId)) {
        next.add(questId);
        newlyCompleted = true;
        this.writeJson(this.questsKey, [...next]);
        this.bumpReputation('You', 5);
        this.bumpReputation('Guest User', 5);
        this.addNotification('love', 'Quest Completed!', `You completed the "${this.questName(questId)}" quest! (+5 Reputation)`, undefined);
      }
      return next;
    });
    return newlyCompleted;
  }

  isQuestCompleted(questId: string): boolean {
    return this.completedQuests().has(questId);
  }

  resetQuests(): void {
    this.completedQuests.set(new Set());
    this.writeJson(this.questsKey, []);
    this.reputation.update((r) => {
      const next = { ...r };
      next['You'] = 0;
      next['Guest User'] = 0;
      this.writeJson(this.reputationKey, next);
      return next;
    });
  }

  private questName(id: string): string {
    const names: Record<string, string> = {
      love: 'Civic Love',
      comment: 'Chatty Neighbor',
      rsvp: 'Active Citizen',
      poll: 'Vocal Resident',
    };
    return names[id] || id;
  }
}
