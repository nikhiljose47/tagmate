import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PostStatus, Tag, ThreadedComment } from '../../../../core/models/tag.model';
import { AppRoute } from '../../../../core/enums/route.enum';
import { TAG_REPOSITORY } from '../../../../core/repositories/repository.tokens';
import { LoggerService } from '../../../../core/services/logger.service';
import { SharedStateService } from '../../../../core/services/shared-state.service';
import { SocialInteractionsService } from '../../../../core/services/social-interactions.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { TagEmojiPipe } from '../../../../shared/pipes/tag-emoji.pipe';
import { TagGradientPipe } from '../../../../shared/pipes/tag-gradient.pipe';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import { LifespanBadgeComponent } from '../../../../shared/components/lifespan-badge/lifespan-badge.component';
import { PostMenuComponent } from '../../../../shared/components/post-menu/post-menu.component';
import { SocialPlatformService } from '../../../../core/services/social-platform.service';
import { SocialProfile, allowedStatusesForTag } from '../../../../core/models/social.model';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AvatarComponent,
    EmptyStateComponent,
    TagEmojiPipe,
    TagGradientPipe,
    TimeAgoPipe,
    LifespanBadgeComponent,
    PostMenuComponent,
  ],
  templateUrl: './post-detail.html',
  styleUrl: './post-detail.scss',
})
export class PostDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tagRepo = inject(TAG_REPOSITORY);
  private readonly shared = inject(SharedStateService);
  private readonly toast = inject(ToastService);
  private readonly logger = inject(LoggerService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly social = inject(SocialInteractionsService);
  protected readonly platform = inject(SocialPlatformService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly post = signal<Tag | null>(null);
  protected readonly relatedPosts = signal<Tag[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly commentText = signal('');
  protected readonly replyText = signal('');
  protected readonly replyTo = signal<string | null>(null);
  protected readonly messageText = signal('');
  protected readonly showMessageBox = signal(false);
  protected readonly mediaIndex = signal(0);
  protected readonly commentSort = signal<'helpful' | 'newest'>('helpful');
  protected readonly editingCommentId = signal<string | null>(null);
  protected readonly editCommentText = signal('');
  protected readonly expandedThreads = signal(new Set<string>());
  protected readonly mentionSuggestions = signal<SocialProfile[]>([]);
  protected readonly mentionContext = signal<'comment' | 'reply'>('comment');
  protected readonly mentionUserIds = signal<Record<string, string>>({});
  protected readonly statusNote = signal('');
  protected readonly statusSaving = signal(false);

  protected readonly visibleComments = computed(() => {
    const post = this.post();
    if (!post) return [];
    const items = this.social.topLevelCommentsFor(post).filter((comment) => !this.platform.isBlocked(comment.authorUid));
    return [...items].sort((a, b) => this.commentSort() === 'helpful'
      ? b.upvotes - a.upvotes || b.createdAt.localeCompare(a.createdAt)
      : b.createdAt.localeCompare(a.createdAt));
  });

  protected readonly postKey = computed(() => {
    const post = this.post();
    return post ? this.social.postKey(post) : '';
  });

  ngOnInit(): void {
    const id = decodeURIComponent(this.route.snapshot.paramMap.get('id') ?? '');
    if (!id) {
      this.isLoading.set(false);
      return;
    }

    this.tagRepo.getById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (post) => {
        this.post.set(post);
        this.isLoading.set(false);
        if (post) {
          this.loadRelated(post);
          void this.platform.hydratePostTrust(this.social.postKey(post));
        }
      },
      error: (err) => {
        this.logger.error('Failed to load post detail', err);
        this.toast.show('Could not load this post.', 'danger');
        this.isLoading.set(false);
      },
    });

    // If this post (or one shown in "related") gets deleted anywhere, react immediately.
    this.social.postDeleted$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((deletedKey) => {
      this.relatedPosts.update((posts) => posts.filter((p) => this.social.postKey(p) !== deletedKey));

      if (this.postKey() === deletedKey) {
        this.toast.show('This post was deleted.', 'info');
        void this.router.navigate([AppRoute.Feed]);
      }
    });
  }

  // Removed ngOnDestroy since ticker interval is gone

  protected neighborhoodSlug(post: Tag): string {
    return this.slugFor(post.hoodId || 'nearby');
  }

  protected toggleLike(): void {
    const post = this.post();
    if (post) this.social.toggleLike(post);
  }

  protected toggleSave(): void {
    const post = this.post();
    if (!post) return;
    const saved = this.social.toggleSave(post);
    this.toast.show(saved ? 'Post saved.' : 'Post removed from saved.', 'success');
  }

  protected addComment(): void {
    const post = this.post();
    if (!post) return;
    this.social.addComment(post, this.commentText());
    this.commentText.set('');
    this.mentionSuggestions.set([]);
  }

  protected addReply(parentId: string): void {
    const post = this.post();
    if (!post) return;
    this.social.addComment(post, this.replyText(), 'You', parentId);
    this.replyText.set('');
    this.replyTo.set(null);
    this.mentionSuggestions.set([]);
  }

  protected upvoteComment(commentId: string): void {
    const post = this.post();
    if (post) this.social.upvoteComment(post, commentId);
  }

  protected repliesFor(commentId: string): ThreadedComment[] {
    const post = this.post();
    if (!post) return [];
    const replies = this.social.repliesFor(post, commentId).filter((reply) => !this.platform.isBlocked(reply.authorUid));
    return this.expandedThreads().has(commentId) ? replies : replies.slice(0, 3);
  }

  protected replyCount(commentId: string): number {
    const post = this.post();
    return post ? this.social.repliesFor(post, commentId).filter((reply) => !this.platform.isBlocked(reply.authorUid)).length : 0;
  }

  protected toggleThread(commentId: string): void {
    this.expandedThreads.update((current) => {
      const next = new Set(current);
      next.has(commentId) ? next.delete(commentId) : next.add(commentId);
      return next;
    });

    this.tagRepo.liveTagUpdates().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((updated) => {
      if (this.postKey() === this.social.postKey(updated)) this.post.set(updated);
      this.relatedPosts.update((posts) => posts.map((post) => this.social.postKey(post) === this.social.postKey(updated) ? updated : post));
    });
  }

  protected beginEdit(comment: ThreadedComment): void {
    this.editingCommentId.set(comment.id);
    this.editCommentText.set(comment.text);
  }

  protected async saveCommentEdit(comment: ThreadedComment): Promise<void> {
    const post = this.post();
    if (post && await this.social.editComment(post, comment, this.editCommentText())) this.editingCommentId.set(null);
  }

  protected async deleteComment(comment: ThreadedComment): Promise<void> {
    const post = this.post();
    if (!post) return;
    const confirmed = await this.confirmDialog.confirm({ title: 'Delete comment?', message: 'The comment text will be removed while replies remain visible.', confirmText: 'Delete', danger: true });
    if (confirmed) await this.social.deleteComment(post, comment);
  }

  protected async reportComment(comment: ThreadedComment): Promise<void> {
    await this.platform.reportComment(comment.id);
  }

  protected onMentionInput(value: string, context: 'comment' | 'reply'): void {
    context === 'comment' ? this.commentText.set(value) : this.replyText.set(value);
    this.mentionContext.set(context);
    const match = value.match(/(?:^|\s)@([a-z0-9_.-]{1,30})$/i);
    if (!match) { this.mentionSuggestions.set([]); return; }
    void this.platform.searchProfiles(match[1], 5).then((profiles) => this.mentionSuggestions.set(profiles));
  }

  protected chooseMention(profile: SocialProfile): void {
    const context = this.mentionContext();
    const source = context === 'comment' ? this.commentText() : this.replyText();
    const updated = source.replace(/@([a-z0-9_.-]*)$/i, `@${profile.name} `);
    context === 'comment' ? this.commentText.set(updated) : this.replyText.set(updated);
    this.mentionSuggestions.set([]);
  }

  protected mentionUid(name: string): string | null {
    const key = name.toLowerCase();
    const cached = this.mentionUserIds()[key];
    if (cached) return cached;
    void this.platform.searchProfiles(name, 3).then((profiles) => {
      const exact = profiles.find((profile) => profile.name.toLowerCase() === key);
      if (exact) this.mentionUserIds.update((state) => ({ ...state, [key]: exact.uid }));
    });
    return null;
  }

  protected allowedStatuses(post: Tag): readonly PostStatus[] { return allowedStatusesForTag(post.tag); }

  protected confirmationCount(post: Tag): number {
    return this.platform.confirmationsFor(this.social.postKey(post)).length || post.verificationCount || 0;
  }

  protected async toggleConfirmation(post: Tag): Promise<void> {
    const confirmed = await this.platform.toggleConfirmation(post);
    this.toast.show(confirmed ? 'Update confirmed.' : 'Confirmation removed.', 'success');
  }

  protected async updateStatus(post: Tag, status: PostStatus): Promise<void> {
    this.statusSaving.set(true);
    const saved = await this.platform.setPostStatus(post, status, this.statusNote());
    this.statusSaving.set(false);
    if (saved) {
      this.post.update((current) => current ? { ...current, currentStatus: status, statusUpdatedAt: new Date().toISOString() } : current);
      this.statusNote.set('');
      this.toast.show(`Post marked ${status}.`, 'success');
    }
  }

  protected toggleRsvp(): void {
    const post = this.post();
    if (!post) return;
    const attending = this.social.toggleRsvp(post);
    this.toast.show(attending ? 'RSVP saved.' : 'RSVP removed.', 'success');
  }

  // --- Polls ---

  votePoll(optionIndex: number): void {
    const p = this.post();
    if (!p) return;
    const key = this.postKey();
    this.social.votePoll(key, optionIndex);
    this.toast.show('Vote recorded!', 'success');
  }

  hasVotedPoll(optionIndex: number): boolean {
    const p = this.post();
    if (!p) return false;
    return this.social.hasVotedPoll(this.postKey(), optionIndex);
  }

  getPollPercentage(optionIndex: number): number {
    const p = this.post();
    if (!p) return 0;
    const key = this.postKey();
    const total = this.social.totalPollVotes(key);
    if (total === 0) return 0;
    const votes = this.social.getPollVotes(key);
    const optKey = optionIndex.toString();
    const count = votes[optKey] ? votes[optKey].length : 0;
    return Math.round((count / total) * 100);
  }

  protected sendMessage(): void {
    const post = this.post();
    if (!post) return;
    this.social.sendMessage(post, this.messageText());
    this.messageText.set('');
    this.showMessageBox.set(false);
  }

  protected openMap(): void {
    const post = this.post();
    if (!post) return;
    this.shared.updateCoordinates(post.lat, post.lng);
    this.shared.updateText(post.highlight || post.hoodId || 'Selected post');
    void this.router.navigate([AppRoute.Hood]);
  }

  protected openDirections(mode: 'driving' | 'walking'): void {
    const post = this.post();
    if (!post || typeof window === 'undefined') return;
    const profile = mode === 'walking' ? 'foot' : 'car';
    const url = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_${profile}&route=;${post.lat},${post.lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  protected selectMedia(index: number): void {
    this.mediaIndex.set(index);
  }

  protected nextMedia(): void {
    const post = this.post();
    if (!post?.images?.length) return;
    this.mediaIndex.set((this.mediaIndex() + 1) % post.images.length);
  }

  protected prevMedia(): void {
    const post = this.post();
    if (!post?.images?.length) return;
    this.mediaIndex.set((this.mediaIndex() - 1 + post.images.length) % post.images.length);
  }

  protected isVideoUrl(url: string): boolean {
    return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
  }

  protected async sharePost(): Promise<void> {
    const post = this.post();
    if (!post) return;
    const text = post.highlight || 'Check out this Tagmate post.';
    const url = typeof window !== 'undefined' ? window.location.href : '';

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Tagmate post', text, url });
        return;
      }

      await navigator.clipboard?.writeText(`${text} ${url}`.trim());
      this.toast.show('Share link copied.', 'success');
    } catch {
      this.toast.show('Share was cancelled.', 'info');
    }
  }

  protected reportPost(): void {
    const post = this.post();
    if (!post) return;
    this.social.reportPost(post);
    this.toast.show('Post hidden and flagged for review.', 'warning');
    void this.router.navigate([AppRoute.Feed]);
  }

  protected async deletePost(): Promise<void> {
    const post = this.post();
    if (!post) return;
    const deleted = await this.social.confirmAndDeletePost(post);
    if (deleted) void this.router.navigate([AppRoute.Feed]);
  }

  private loadRelated(post: Tag): void {
    this.tagRepo.getFiltered({ tags: [post.tag] }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (posts) => {
        this.relatedPosts.set(
          posts
            .filter((candidate) => this.social.postKey(candidate) !== this.social.postKey(post))
            .filter((candidate) => !this.platform.isBlocked(candidate.userId))
            .slice(0, 3)
        );
      },
      error: (err) => this.logger.error('Failed to load related posts', err),
    });
  }

  private slugFor(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'nearby';
  }
}
