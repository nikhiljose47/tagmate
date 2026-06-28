import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Tag } from '../../../../core/models/tag.model';
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
  protected readonly social = inject(SocialInteractionsService);

  protected readonly post = signal<Tag | null>(null);
  protected readonly relatedPosts = signal<Tag[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly commentText = signal('');

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

    this.tagRepo.getById(id).subscribe({
      next: (post) => {
        this.post.set(post);
        this.isLoading.set(false);
        if (post) this.loadRelated(post);
      },
      error: (err) => {
        this.logger.error('Failed to load post detail', err);
        this.toast.show('Could not load this post.', 'danger');
        this.isLoading.set(false);
      },
    });
  }

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
  }

  protected openMap(): void {
    const post = this.post();
    if (!post) return;
    this.shared.updateCoordinates(post.lat, post.lng);
    this.shared.updateText(post.highlight || post.hoodId || 'Selected post');
    void this.router.navigate([AppRoute.Hood]);
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

  private loadRelated(post: Tag): void {
    this.tagRepo.getAll().subscribe({
      next: (posts) => {
        this.relatedPosts.set(
          posts
            .filter((candidate) => candidate.tag === post.tag && this.social.postKey(candidate) !== this.social.postKey(post))
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
