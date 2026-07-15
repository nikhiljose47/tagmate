import { Injectable, OnDestroy, WritableSignal, inject, signal } from '@angular/core';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import {
  SocialProfile,
  PostConfirmation,
  PostStatusEntry,
  ACTIONABLE_TAGS,
} from '../models/social.model';
import { PostStatus, Tag } from '../models/tag.model';
import { SupabaseService } from './supabase.service';
import { UserSessionService } from './user-session.service';
import { LoggerService } from './logger.service';
import { ToastService } from './toast.service';
import { CommentService } from './comment.service';
import { MessagingService } from './messaging.service';
import { RelationshipService } from './relationship.service';
import { PostTrustService } from './post-trust.service';
import { rowToTag } from './tag.mapper';

interface UserFollowRow {
  follower_id: string;
  followed_user_id: string;
}
interface HoodFollowRow {
  user_id: string;
  hood_id: string;
}
interface TopicFollowRow {
  user_id: string;
  tag: string;
}
interface BlockRow {
  blocker_id: string;
  blocked_id: string;
}
interface MutedThreadRow {
  user_id: string;
  thread_id: string;
}
interface CommentReactionRow {
  comment_id: string;
  user_id: string;
}
interface ConfirmationRow {
  post_id: string;
  user_id: string;
  created_at: string;
}
interface StatusRow {
  id: string;
  post_id: string;
  actor_id: string | null;
  status: PostStatus;
  note: string | null;
  created_at: string;
}
interface DirectMessageStateRow {
  id: string;
  thread_id: string;
  from_uid: string;
  to_uid: string;
  read: boolean;
}
interface ProfileRow {
  uid: string;
  name: string;
  bio: string | null;
  reputation: number | null;
  created_at?: string;
  updated_at?: string;
}

@Injectable({ providedIn: 'root' })
export class SocialPlatformService implements OnDestroy {
  private readonly supabase = inject(SupabaseService);
  private readonly session = inject(UserSessionService);
  private readonly logger = inject(LoggerService);
  private readonly toast = inject(ToastService);
  private readonly commentsApi = inject(CommentService);
  private readonly messagingApi = inject(MessagingService);
  private readonly relationshipsApi = inject(RelationshipService);
  private readonly postTrustApi = inject(PostTrustService);
  private readonly destroy$ = new Subject<void>();
  private readonly unreadMessageThreads = new Map<string, string>();
  private hydratedUid: string | null = null;

  readonly followedUsers = signal(new Set<string>());
  readonly followedHoods = signal(new Set<string>());
  readonly followedTopics = signal(new Set<string>());
  readonly blockedUsers = signal(new Set<string>());
  readonly mutedThreads = signal(new Set<string>());
  readonly reactedComments = signal(new Set<string>());
  readonly confirmations = signal<Record<string, PostConfirmation[]>>({});
  readonly statusHistory = signal<Record<string, PostStatusEntry[]>>({});
  readonly unreadMessages = signal(0);
  readonly isAdmin = signal(false);

  constructor() {
    this.supabase.session$.pipe(takeUntil(this.destroy$)).subscribe((session) => {
      const uid = session?.user?.id ?? null;
      this.isAdmin.set(session?.user?.app_metadata?.['role'] === 'admin');
      if (uid && uid !== this.hydratedUid) {
        this.hydratedUid = uid;
        void this.hydrateViewerState(uid);
      } else if (!uid) {
        this.hydratedUid = null;
        this.resetViewerState();
      }
    });

    this.supabase
      .liveInserts<ConfirmationRow>('post_confirmations')
      .pipe(takeUntil(this.destroy$))
      .subscribe((row) => this.mergeConfirmation(row));
    this.supabase
      .liveDeletes<ConfirmationRow>('post_confirmations')
      .pipe(takeUntil(this.destroy$))
      .subscribe((row) => this.removeConfirmation(row));
    this.supabase
      .liveInserts<StatusRow>('post_status_history')
      .pipe(takeUntil(this.destroy$))
      .subscribe((row) => this.mergeStatus(row));
    this.supabase
      .liveInserts<DirectMessageStateRow>('direct_messages')
      .pipe(takeUntil(this.destroy$))
      .subscribe((row) => {
        if (row.to_uid === this.myUid() && !row.read) {
          this.unreadMessageThreads.set(row.id, row.thread_id);
          this.syncUnreadCount();
        }
      });
    this.supabase
      .liveUpdates<DirectMessageStateRow>('direct_messages')
      .pipe(takeUntil(this.destroy$))
      .subscribe((row) => {
        // A read transition is already fully described by the realtime row.
        // Avoid re-fetching the user's entire inbox for every read receipt.
        if (row.to_uid === this.myUid() && row.read) {
          this.unreadMessageThreads.delete(row.id);
          this.syncUnreadCount();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  myUid(): string | null {
    return this.session.user()?.uid ?? null;
  }

  isActionable(post: Tag): boolean {
    return !!post.id && ACTIONABLE_TAGS.has(post.tag);
  }

  canSetStatus(post: Tag): boolean {
    const uid = this.myUid();
    return !!uid && this.isActionable(post) && (post.userId === uid || this.isAdmin());
  }

  isFollowingUser(uid: string): boolean {
    return this.followedUsers().has(uid);
  }
  isFollowingHood(hoodId: string): boolean {
    return this.followedHoods().has(hoodId);
  }
  isFollowingTopic(tag: string): boolean {
    return this.followedTopics().has(tag);
  }
  isBlocked(uid: string): boolean {
    return this.blockedUsers().has(uid);
  }
  isThreadMuted(threadId: string): boolean {
    return this.mutedThreads().has(threadId);
  }
  isCommentReacted(commentId: string): boolean {
    return this.reactedComments().has(commentId);
  }

  async getProfile(uid: string): Promise<SocialProfile | null> {
    try {
      const user = await firstValueFrom(this.relationshipsApi.getProfile(uid));
      if (!user || user.isGuest || this.isBlocked(uid)) return null;
      return {
        uid: user.uid,
        name: user.name,
        bio: user.bio ?? '',
        reputation: user.reputation ?? 0,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      this.logger.warn('Could not load public profile', error);
      return null;
    }
  }

  async searchProfiles(query: string, limit = 6): Promise<SocialProfile[]> {
    try {
      const { data } = await firstValueFrom(this.relationshipsApi.searchProfiles(query, limit));
      return ((data ?? []) as ProfileRow[])
        .filter((row) => !this.isBlocked(row.uid))
        .map((row) => this.mapProfile(row));
    } catch (error) {
      this.logger.warn('Could not search profiles', error);
      return [];
    }
  }

  async updateOwnProfile(name: string, bio: string): Promise<boolean> {
    const uid = this.myUid();
    const cleanName = name.trim();
    const cleanBio = bio.trim();
    if (!uid || !cleanName || cleanName.length > 40 || cleanBio.length > 280) return false;
    try {
      await firstValueFrom(
        this.relationshipsApi.updateProfile(uid, cleanName, cleanBio, new Date().toISOString()),
      );
      const current = this.session.user();
      if (current)
        this.session.user.set({
          ...current,
          name: cleanName,
          bio: cleanBio,
          updatedAt: new Date().toISOString(),
        });
      return true;
    } catch (error) {
      this.logger.error('Profile update failed', error);
      this.toast.show('Could not update your profile.', 'danger');
      return false;
    }
  }

  async toggleFollowUser(targetUid: string): Promise<boolean> {
    const uid = this.myUid();
    if (!uid || uid === targetUid || this.isBlocked(targetUid)) return false;
    return this.toggleSetRow(
      this.followedUsers,
      targetUid,
      'user_follows',
      { follower_id: uid, followed_user_id: targetUid },
      { follower_id: uid, followed_user_id: targetUid },
    );
  }

  async toggleFollowHood(hoodId: string): Promise<boolean> {
    const uid = this.myUid();
    const id = hoodId.trim();
    if (!uid || !id) return false;
    return this.toggleSetRow(
      this.followedHoods,
      id,
      'user_followed_hoods',
      { user_id: uid, hood_id: id },
      { user_id: uid, hood_id: id },
    );
  }

  async toggleFollowTopic(tag: string): Promise<boolean> {
    const uid = this.myUid();
    const id = tag.trim();
    if (!uid || !id) return false;
    return this.toggleSetRow(
      this.followedTopics,
      id,
      'user_followed_topics',
      { user_id: uid, tag: id },
      { user_id: uid, tag: id },
    );
  }

  async blockUser(targetUid: string): Promise<boolean> {
    const uid = this.myUid();
    if (!uid || uid === targetUid) return false;
    if (this.isBlocked(targetUid)) return true;
    this.addToSet(this.blockedUsers, targetUid);
    this.removeFromSet(this.followedUsers, targetUid);
    try {
      await firstValueFrom(
        this.supabase.addRow('user_blocks', { blocker_id: uid, blocked_id: targetUid }),
      );
      await firstValueFrom(
        this.supabase.deleteRowsWhere('user_follows', {
          follower_id: uid,
          followed_user_id: targetUid,
        }),
      );
      return true;
    } catch (error) {
      this.removeFromSet(this.blockedUsers, targetUid);
      this.logger.error('Block failed', error);
      this.toast.show('Could not block this user.', 'danger');
      return false;
    }
  }

  async unblockUser(targetUid: string): Promise<boolean> {
    const uid = this.myUid();
    if (!uid || !this.isBlocked(targetUid)) return false;
    this.removeFromSet(this.blockedUsers, targetUid);
    try {
      await firstValueFrom(
        this.supabase.deleteRowsWhere('user_blocks', { blocker_id: uid, blocked_id: targetUid }),
      );
      return true;
    } catch (error) {
      this.addToSet(this.blockedUsers, targetUid);
      this.logger.error('Unblock failed', error);
      return false;
    }
  }

  async toggleThreadMute(threadId: string): Promise<boolean> {
    const uid = this.myUid();
    if (!uid) return false;
    const result = await this.toggleSetRow(
      this.mutedThreads,
      threadId,
      'muted_threads',
      { user_id: uid, thread_id: threadId },
      { user_id: uid, thread_id: threadId },
    );
    this.syncUnreadCount();
    return result;
  }

  async followingFeed(limit: number, offset: number, query = ''): Promise<Tag[]> {
    const { data } = await firstValueFrom(
      this.relationshipsApi.followingFeed(limit, offset, query),
    );
    return (data ?? []).map(rowToTag);
  }

  async hydratePostTrust(postId: string): Promise<void> {
    try {
      const [confirmResult, statusResult] = await Promise.all([
        firstValueFrom(
          this.supabase.getRows<ConfirmationRow>('post_confirmations', {
            field: 'post_id',
            op: '==',
            value: postId,
          }),
        ),
        firstValueFrom(
          this.supabase.getRows<StatusRow>('post_status_history', {
            field: 'post_id',
            op: '==',
            value: postId,
          }),
        ),
      ]);
      const confirmations = confirmResult.data ?? [];
      const statuses = statusResult.data ?? [];
      const userIds = Array.from(
        new Set([
          ...confirmations.map((row) => row.user_id),
          ...statuses.map((row) => row.actor_id).filter((id): id is string => !!id),
        ]),
      );
      const names = new Map<string, string>();
      if (userIds.length) {
        const { data } = await firstValueFrom(
          this.supabase.getRowsIn<{ uid: string; name: string }>('users', 'uid', userIds),
        );
        for (const row of data ?? []) names.set(row.uid, row.name);
      }
      this.confirmations.update((state) => ({
        ...state,
        [postId]: confirmations
          .map((row) => this.mapConfirmation(row, names.get(row.user_id)))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      }));
      this.statusHistory.update((state) => ({
        ...state,
        [postId]: statuses
          .map((row) => this.mapStatus(row, row.actor_id ? names.get(row.actor_id) : undefined))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      }));
    } catch (error) {
      this.logger.warn('Could not load post verification data', error);
    }
  }

  confirmationsFor(postId: string): PostConfirmation[] {
    return this.confirmations()[postId] ?? [];
  }
  statusFor(postId: string): PostStatusEntry[] {
    return this.statusHistory()[postId] ?? [];
  }
  hasConfirmed(postId: string): boolean {
    const uid = this.myUid();
    return !!uid && this.confirmationsFor(postId).some((item) => item.userId === uid);
  }

  async toggleConfirmation(post: Tag): Promise<boolean> {
    const uid = this.myUid();
    const postId = post.id;
    if (!uid || !postId || post.userId === uid || !this.isActionable(post)) return false;
    const wasConfirmed = this.hasConfirmed(postId);
    const optimistic: PostConfirmation = {
      postId,
      userId: uid,
      userName: this.session.user()?.name,
      createdAt: new Date().toISOString(),
    };
    this.confirmations.update((state) => ({
      ...state,
      [postId]: wasConfirmed
        ? (state[postId] ?? []).filter((item) => item.userId !== uid)
        : [optimistic, ...(state[postId] ?? [])],
    }));
    try {
      if (wasConfirmed)
        await firstValueFrom(
          this.postTrustApi.setConfirmation(postId, uid, false),
        );
      else
        await firstValueFrom(
          this.postTrustApi.setConfirmation(postId, uid, true),
        );
      return !wasConfirmed;
    } catch (error) {
      await this.hydratePostTrust(postId);
      this.logger.error('Confirmation toggle failed', error);
      this.toast.show('Could not update confirmation.', 'danger');
      return wasConfirmed;
    }
  }

  async setPostStatus(post: Tag, status: PostStatus, note: string): Promise<boolean> {
    const uid = this.myUid();
    if (!uid || !post.id || !this.canSetStatus(post)) return false;
    try {
      await firstValueFrom(
        this.postTrustApi.addStatus(post.id, uid, status, note.trim().slice(0, 250) || null),
      );
      return true;
    } catch (error) {
      this.logger.error('Status update failed', error);
      this.toast.show('Could not update post status.', 'danger');
      return false;
    }
  }

  async toggleCommentReaction(commentId: string): Promise<boolean> {
    const uid = this.myUid();
    if (!uid) return false;
    return this.toggleSetRow(
      this.reactedComments,
      commentId,
      'post_comment_reactions',
      { comment_id: commentId, user_id: uid },
      { comment_id: commentId, user_id: uid },
    );
  }

  async reportComment(commentId: string, reason = 'reported'): Promise<boolean> {
    const uid = this.myUid();
    if (!uid) return false;
    try {
      await firstValueFrom(this.commentsApi.report(commentId, uid, reason));
      this.toast.show('Report submitted for review.', 'success');
      return true;
    } catch (error) {
      this.logger.error('Comment report failed', error);
      this.toast.show('Could not submit report.', 'danger');
      return false;
    }
  }

  async reportMessage(messageId: string, reason = 'reported'): Promise<boolean> {
    const uid = this.myUid();
    if (!uid) return false;
    try {
      await firstValueFrom(this.messagingApi.report(messageId, uid, reason));
      this.toast.show('Report submitted for review.', 'success');
      return true;
    } catch (error) {
      this.logger.error('Message report failed', error);
      this.toast.show('Could not submit report.', 'danger');
      return false;
    }
  }

  async reportUser(userId: string, reason = 'reported'): Promise<boolean> {
    const uid = this.myUid();
    if (!uid) return false;
    try {
      await firstValueFrom(this.relationshipsApi.reportUser(userId, uid, reason));
      this.toast.show('Report submitted for review.', 'success');
      return true;
    } catch (error) {
      this.logger.error('User report failed', error);
      this.toast.show('Could not submit report.', 'danger');
      return false;
    }
  }

  async markThreadRead(threadId: string): Promise<void> {
    const uid = this.myUid();
    if (!uid) return;
    const readAt = new Date().toISOString();
    await firstValueFrom(
      this.messagingApi.markThreadRead(threadId, uid, readAt),
    );
    for (const [messageId, unreadThreadId] of this.unreadMessageThreads) {
      if (unreadThreadId === threadId) this.unreadMessageThreads.delete(messageId);
    }
    this.syncUnreadCount();
  }

  private async hydrateViewerState(uid: string): Promise<void> {
    try {
      const [users, hoods, topics, blocks, muted, reactions, messages] = await Promise.all([
        firstValueFrom(
          this.supabase.getRows<UserFollowRow>('user_follows', {
            field: 'follower_id',
            op: '==',
            value: uid,
          }),
        ),
        firstValueFrom(
          this.supabase.getRows<HoodFollowRow>('user_followed_hoods', {
            field: 'user_id',
            op: '==',
            value: uid,
          }),
        ),
        firstValueFrom(
          this.supabase.getRows<TopicFollowRow>('user_followed_topics', {
            field: 'user_id',
            op: '==',
            value: uid,
          }),
        ),
        firstValueFrom(
          this.supabase.getRows<BlockRow>('user_blocks', {
            field: 'blocker_id',
            op: '==',
            value: uid,
          }),
        ),
        firstValueFrom(
          this.supabase.getRows<MutedThreadRow>('muted_threads', {
            field: 'user_id',
            op: '==',
            value: uid,
          }),
        ),
        firstValueFrom(
          this.supabase.getRows<CommentReactionRow>('post_comment_reactions', {
            field: 'user_id',
            op: '==',
            value: uid,
          }),
        ),
        firstValueFrom(this.supabase.getDirectMessagesForUser(uid)),
      ]);
      this.followedUsers.set(new Set((users.data ?? []).map((row) => row.followed_user_id)));
      this.followedHoods.set(new Set((hoods.data ?? []).map((row) => row.hood_id)));
      this.followedTopics.set(new Set((topics.data ?? []).map((row) => row.tag)));
      this.blockedUsers.set(new Set((blocks.data ?? []).map((row) => row.blocked_id)));
      this.mutedThreads.set(new Set((muted.data ?? []).map((row) => row.thread_id)));
      this.reactedComments.set(new Set((reactions.data ?? []).map((row) => row.comment_id)));
      this.unreadMessageThreads.clear();
      for (const row of messages.data ?? []) {
        if (row.to_uid === uid && !row.read) this.unreadMessageThreads.set(row.id, row.thread_id);
      }
      this.syncUnreadCount();
    } catch (error) {
      this.logger.warn('Could not hydrate social graph', error);
    }
  }

  private resetViewerState(): void {
    this.followedUsers.set(new Set());
    this.followedHoods.set(new Set());
    this.followedTopics.set(new Set());
    this.blockedUsers.set(new Set());
    this.mutedThreads.set(new Set());
    this.reactedComments.set(new Set());
    this.confirmations.set({});
    this.statusHistory.set({});
    this.unreadMessageThreads.clear();
    this.unreadMessages.set(0);
  }

  private async toggleSetRow(
    state: WritableSignal<Set<string>>,
    key: string,
    table: string,
    insertRow: Record<string, unknown>,
    deleteMatchers: Record<string, unknown>,
  ): Promise<boolean> {
    const enabled = state().has(key);
    enabled ? this.removeFromSet(state, key) : this.addToSet(state, key);
    try {
      if (enabled) await firstValueFrom(this.supabase.deleteRowsWhere(table, deleteMatchers));
      else await firstValueFrom(this.supabase.addRow(table, insertRow));
      return !enabled;
    } catch (error) {
      enabled ? this.addToSet(state, key) : this.removeFromSet(state, key);
      this.logger.error(`Toggle failed for ${table}`, error);
      this.toast.show('Could not save that change.', 'danger');
      return enabled;
    }
  }

  private syncUnreadCount(): void {
    let count = 0;
    for (const threadId of this.unreadMessageThreads.values()) {
      if (!this.isThreadMuted(threadId)) count++;
    }
    this.unreadMessages.set(count);
  }

  private addToSet(state: WritableSignal<Set<string>>, value: string): void {
    state.update((current) => new Set([...current, value]));
  }

  private removeFromSet(state: WritableSignal<Set<string>>, value: string): void {
    state.update((current) => {
      const next = new Set(current);
      next.delete(value);
      return next;
    });
  }

  private mapProfile(row: ProfileRow): SocialProfile {
    return {
      uid: row.uid,
      name: row.name,
      bio: row.bio ?? '',
      reputation: row.reputation ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapConfirmation(row: ConfirmationRow, userName?: string): PostConfirmation {
    return { postId: row.post_id, userId: row.user_id, userName, createdAt: row.created_at };
  }

  private mapStatus(row: StatusRow, actorName?: string): PostStatusEntry {
    return {
      id: row.id,
      postId: row.post_id,
      actorId: row.actor_id ?? undefined,
      actorName,
      status: row.status,
      note: row.note ?? undefined,
      createdAt: row.created_at,
    };
  }

  private mergeConfirmation(row: ConfirmationRow): void {
    const current = this.confirmations()[row.post_id];
    if (!current || current.some((item) => item.userId === row.user_id)) return;
    this.confirmations.update((state) => ({
      ...state,
      [row.post_id]: [this.mapConfirmation(row), ...current],
    }));
  }

  private removeConfirmation(row: ConfirmationRow): void {
    const current = this.confirmations()[row.post_id];
    if (!current) return;
    this.confirmations.update((state) => ({
      ...state,
      [row.post_id]: current.filter((item) => item.userId !== row.user_id),
    }));
  }

  private mergeStatus(row: StatusRow): void {
    const current = this.statusHistory()[row.post_id];
    if (!current || current.some((item) => item.id === row.id)) return;
    this.statusHistory.update((state) => ({
      ...state,
      [row.post_id]: [this.mapStatus(row), ...current],
    }));
  }
}
