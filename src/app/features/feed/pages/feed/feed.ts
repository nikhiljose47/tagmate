import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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

type FeedMode = 'forYou' | 'nearby' | 'following' | 'saved';

@Component({
  selector: 'app-feed',
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
  templateUrl: './feed.html',
  styleUrl: './feed.scss',
})
export class FeedPage implements OnInit {
  private readonly router = inject(Router);
  private readonly tagRepo = inject(TAG_REPOSITORY);
  private readonly shared = inject(SharedStateService);
  private readonly toast = inject(ToastService);
  private readonly logger = inject(LoggerService);
  protected readonly social = inject(SocialInteractionsService);

  protected readonly posts = signal<Tag[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly mode = signal<FeedMode>('forYou');
  protected readonly selectedCategory = signal('all');
  protected readonly searchText = signal('');

  protected readonly categories = computed(() => [
    'all',
    ...Array.from(new Set(this.posts().map((post) => post.tag).filter(Boolean))).sort(),
  ]);

  protected readonly visiblePosts = computed(() => {
    const category = this.selectedCategory();
    const query = this.searchText().trim().toLowerCase();

    return [...this.posts()]
      .filter((post) => {
        if (this.social.isHidden(post)) return false;
        if (category !== 'all' && post.tag !== category) return false;
        if (this.mode() === 'saved' && !this.social.isSaved(post)) return false;
        if (!query) return true;

        return [post.highlight, post.username, post.tag, post.hoodId]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (this.mode() === 'nearby') {
          return Math.abs(a.lat) + Math.abs(a.lng) - (Math.abs(b.lat) + Math.abs(b.lng));
        }

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  });

  ngOnInit(): void {
    this.loadPosts();
  }

  protected loadPosts(): void {
    this.isLoading.set(true);
    this.tagRepo.getAll().subscribe({
      next: (posts) => {
        this.posts.set(posts);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.logger.error('Failed to load feed', err);
        this.toast.show('Could not load the feed.', 'danger');
        this.isLoading.set(false);
      },
    });
  }

  protected setMode(mode: FeedMode): void {
    this.mode.set(mode);
  }

  protected setCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  protected postKey(post: Tag): string {
    return this.social.postKey(post);
  }

  protected neighborhoodSlug(post: Tag): string {
    return this.slugFor(post.hoodId || 'nearby');
  }

  protected toggleLike(post: Tag): void {
    this.social.toggleLike(post);
  }

  protected toggleSave(post: Tag): void {
    const saved = this.social.toggleSave(post);
    this.toast.show(saved ? 'Post saved.' : 'Post removed from saved.', 'success');
  }

  protected openMap(post: Tag): void {
    this.shared.updateCoordinates(post.lat, post.lng);
    this.shared.updateText(post.highlight || post.hoodId || 'Selected post');
    void this.router.navigate([AppRoute.Hood]);
  }

  protected async sharePost(post: Tag): Promise<void> {
    const text = post.highlight || 'Check out this Tagmate post.';
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/posts/${encodeURIComponent(this.postKey(post))}`
        : '';

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

  protected reportPost(post: Tag): void {
    this.social.reportPost(post);
    this.toast.show('Post hidden and flagged for review.', 'warning');
  }

  private slugFor(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'nearby';
  }
}
