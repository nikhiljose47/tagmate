import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { DirectMessage, LocalNotification, Tag, ThreadedComment } from '../models/tag.model';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { LoggerService } from './logger.service';
import { ToastService } from './toast.service';
import { ConfirmDialogService } from './confirm-dialog.service';
import { TAG_REPOSITORY } from '../repositories/repository.tokens';
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

const QUESTS_KEY = 'tagmate.completedQuests';
const QUEST_NAMES: Record<string, string> = {
  love: 'Civic Love',
  comment: 'Chatty Neighbor',
  rsvp: 'Active Citizen',
  poll: 'Vocal Resident',
};

/**
 * Supabase-backed social interactions. Every public method here keeps its
 * exact original signature so every calling component stays untouched — only
 * the internals moved from localStorage to Postgres. See the migration plan
 * (persist-social-interactions) for the full design rationale.
 *
 * Quests (`completeQuest`/`isQuestCompleted`/`resetQuests`) are a local-only
 * achievement layer, not synced to Supabase — real reputation is entirely
 * trigger-maintained server-side (see `trustScore`), so quests never bump it
 * directly; they're just a checklist badge kept in this browser.
 */
@Injectable({ providedIn: 'root' })
export class SocialInteractionsService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly logger = inject(LoggerService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly tagRepo = inject(TAG_REPOSITORY);

  // ---- deletion (broadcast so every page holding its own copy of a post list can react) ----
  private readonly _postDeleted$ = new Subject<string>();
  /** Emits the postKey of a tag right after it's confirmed deleted server-side. */
  readonly postDeleted$ = this._postDeleted$.asObservable();

  // ---- identity ----
  private readonly currentUid = signal<string | null>(null);
  private currentUsername = 'Guest';
  private lastHydratedUid: string | null = null;

  // ---- personal / viewer-specific state ----
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

  // Optimistic overlays on top of the trigger-maintained aggregate columns on
  // `tags` — keeps counts instant on click without an extra query per toggle.
  private readonly likeDeltas = signal<Record<string, number>>({});
  private readonly commentDeltas = signal<Record<string, number>>({});
  private readonly rsvpDeltas = signal<Record<string, number>>({});
  private readonly reputationCache = signal<Record<string, number>>({});

  // Coalesced batch fetch for "did I like/rsvp this" across a whole rendered
  // list — one query per table per render pass, not one per post.
  private readonly pendingBatchIds = new Set<string>();
  private readonly hydratedLikeRsvp = new Set<string>();
  private batchScheduled = false;

  // Per-post/thread lazy hydration guards (comments, poll tallies, DM threads).
  private readonly hydratingComments = new Set<string>();
  private readonly hydratingPoll = new Set<string>();
  private readonly hydratingThreads = new Set<string>();
  private readonly hydratingReputation = new Set<string>();

  constructor() {
    this.supabase.session$.subscribe((session) => {
      const uid = session?.user?.id ?? null;
      this.currentUid.set(uid);
      if (uid && uid !== this.lastHydratedUid) {
        this.lastHydratedUid = uid;
        this.hydratePersonalData(uid);

        // Sync quests from metadata if they exist
        const metadataQuests = session?.user?.user_metadata?.['completed_quests'] as string[] | undefined;
        if (metadataQuests) {
          this.completedQuests.set(new Set(metadataQuests));
          this.writeJson(QUESTS_KEY, metadataQuests);
        }
      } else if (!uid) {
        this.lastHydratedUid = null;
        this.resetPersonalSignals();
      }
    });

    // Cosmetic only — display-name fallback while the real session resolves.
    this.auth.user$.subscribe((u) => { this.currentUsername = u.username; });

    this.completedQuests.set(new Set(this.readJson<string[]>(QUESTS_KEY, [])));

    this.registerRealtime();
  }

  postKey(post: Tag): string {
    return post.id ?? `${post.userId}-${post.createdAt}`;
  }

  /** Current viewer's uid (null until the session resolves), for components that used to hardcode 'Guest User'/'You'. */
  myUid(): string | null {
    return this.currentUid();
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

    if (nowLiked) this.completeQuest('love');
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

  // ---------- DELETE ----------

  /** Whether the current viewer owns this post (and can therefore delete it). */
  canDelete(post: Tag): boolean {
    const uid = this.currentUid();
    return !!uid && !!post.userId && uid === post.userId;
  }

  /**
   * Confirms with the user, deletes the post from Supabase, and broadcasts
   * `postDeleted$` so every page holding a local copy of this post can drop it
   * immediately — no reload required. Returns true if the post was deleted.
   */
  async confirmAndDeletePost(post: Tag): Promise<boolean> {
    if (!post.id) return false;

    if (!this.canDelete(post)) {
      this.toast.show('You do not have permission to delete this post.', 'danger');
      return false;
    }

    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete this post?',
      message: 'This can\'t be undone. Your post will be removed for everyone.',
      confirmText: 'Delete',
      cancelText: 'Keep it',
      danger: true,
    });
    if (!confirmed) return false;

    const key = this.postKey(post);
    try {
      await firstValueFrom(this.tagRepo.delete(post.id));
      this._postDeleted$.next(key);
      this.toast.show('Post deleted.', 'success');
      return true;
    } catch (err) {
      this.logger.error('Failed to delete post', err);
      this.toast.show('Could not delete post. Please try again.', 'danger');
      return false;
    }
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
    this.comments.update((c) => ({ ...c, [key]: [...(c[key] ?? []), optimisticComment] }));
    this.bumpDelta(this.commentDeltas, key, 1);

    const row = {
      post_id: post.id,
      parent_id: parentId ?? null,
      author_uid: uid,
      author_name: author,
      text: trimmed,
      mentions,
    };

    firstValueFrom(this.supabase.addRow('post_comments', row))
      .then(({ data, error }) => {
        if (error || !data) throw error ?? new Error('addComment: no row returned');
        const commentRow = data as PostCommentRow;
        this.comments.update((c) => ({
          ...c,
          [key]: (c[key] ?? []).map((cm) => (cm.id === optimisticId ? rowToComment(commentRow) : cm)),
        }));
      })
      .catch((err) => {
        this.logger.error('addComment failed, rolling back', err);
        this.comments.update((c) => ({ ...c, [key]: (c[key] ?? []).filter((cm) => cm.id !== optimisticId) }));
        this.bumpDelta(this.commentDeltas, key, -1);
        this.toast.show('Could not post your comment — please try again.', 'danger');
      });

    this.completeQuest('comment');

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

  votePoll(postKey: string, optionIndex: number, _username: string): void {
    const uid = this.currentUid();
    if (!uid) { this.warnSignInRequired('vote'); return; }

    const prevForPost = this.pollVotes()[postKey] ?? {};
    const nextForPost = this.applyVoteOptimistically(prevForPost, optionIndex, uid);
    this.pollVotes.update((v) => ({ ...v, [postKey]: nextForPost }));

    void this.fireAndForget(
      this.supabase.upsertRow(
        'post_poll_votes',
        { post_id: postKey, option_index: optionIndex, user_id: uid },
        'post_id,user_id'
      ),
      (err) => {
        this.logger.error('votePoll failed, rolling back', err);
        this.pollVotes.update((v) => ({ ...v, [postKey]: prevForPost }));
        this.toast.show('Could not record your vote — please try again.', 'danger');
      }
    );

    this.completeQuest('poll');
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

    if (nowAttending) {
      this.pushLocalNotification('rsvp', 'RSVP saved', `You are attending ${post.highlight || 'this event'}.`, key);
      this.completeQuest('rsvp');
    }
    return nowAttending;
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

  // ---------- QUESTS (local-only achievement layer) ----------

  completeQuest(questId: string): boolean {
    let newlyCompleted = false;
    this.completedQuests.update((current) => {
      if (current.has(questId)) return current;
      newlyCompleted = true;
      const next = new Set(current).add(questId);
      this.writeJson(QUESTS_KEY, [...next]);
      return next;
    });
    if (newlyCompleted) {
      this.pushLocalNotification(
        'love',
        'Quest Completed!',
        `You completed the "${QUEST_NAMES[questId] ?? questId}" quest!`
      );
      this.toast.show(`🏆 Quest Completed: "${QUEST_NAMES[questId] ?? questId}"! +5 Reputation`, 'quest', 5000);

      const uid = this.currentUid();
      if (uid) {
        const currentQuests = Array.from(this.completedQuests());
        void this.fireAndForget(
          this.supabase.updateUserMetadata({ completed_quests: currentQuests }),
          (err) => this.logger.warn('Failed to sync completed quests to Supabase', err)
        );
      }
    }
    return newlyCompleted;
  }

  isQuestCompleted(questId: string): boolean {
    return this.completedQuests().has(questId);
  }

  resetQuests(): void {
    this.completedQuests.set(new Set());
    this.writeJson(QUESTS_KEY, []);
    const uid = this.currentUid();
    if (uid) {
      void this.fireAndForget(
        this.supabase.updateUserMetadata({ completed_quests: [] }),
        (err) => this.logger.warn('Failed to reset quest metadata in Supabase', err)
      );
    }
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

    // Reload quest progress from local storage for guests
    this.completedQuests.set(new Set(this.readJson<string[]>(QUESTS_KEY, [])));
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

  private warnSignInRequired(action: string): void {
    this.logger.warn(`Tried to ${action} before a session was ready — ignored.`);
  }

  /** Awaits a Supabase write, treating a resolved `{error}` field as a rejection too. */
  private async fireAndForget(
    obs: Observable<unknown>,
    onError: (err: unknown) => void
  ): Promise<void> {
    try {
      const result = await firstValueFrom(obs);
      if (result && typeof result === 'object' && 'error' in result && (result as { error: unknown }).error) {
        throw (result as { error: unknown }).error;
      }
    } catch (err) {
      onError(err);
    }
  }

  private toggleInSet(sig: WritableSignal<Set<string>>, key: string, shouldHave: boolean): void {
    sig.update((current) => {
      const next = new Set(current);
      if (shouldHave) next.add(key); else next.delete(key);
      return next;
    });
  }

  private addToSetLocal(sig: WritableSignal<Set<string>>, key: string): void {
    sig.update((current) => new Set(current).add(key));
  }

  private bumpDelta(sig: WritableSignal<Record<string, number>>, key: string, amount: number): void {
    sig.update((d) => ({ ...d, [key]: (d[key] ?? 0) + amount }));
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
      // Local quest state should never block the main posting flow.
    }
  }
}
