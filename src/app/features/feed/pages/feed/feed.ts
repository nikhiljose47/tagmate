import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, AfterViewInit, computed, inject, signal, ViewChild, ElementRef, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
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
import { LifespanBadgeComponent } from '../../../../shared/components/lifespan-badge/lifespan-badge.component';
import { selectHood } from '../../../../store/user-preferences/user-preference.selectors';
import { PostMenuComponent } from '../../../../shared/components/post-menu/post-menu.component';
import { Subject, takeUntil } from 'rxjs';

type FeedMode = 'forYou' | 'nearby' | 'saved';

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
    LifespanBadgeComponent,
    PostMenuComponent,
  ],
  templateUrl: './feed.html',
  styleUrl: './feed.scss',
})
export class FeedPage implements OnInit, OnDestroy, AfterViewInit {
  private readonly router = inject(Router);
  private readonly tagRepo = inject(TAG_REPOSITORY);
  private readonly shared = inject(SharedStateService);
  private readonly toast = inject(ToastService);
  private readonly logger = inject(LoggerService);
  private readonly store = inject(Store);
  protected readonly social = inject(SocialInteractionsService);

  protected readonly posts = signal<Tag[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isLoadingMore = signal(false);
  protected readonly loadError = signal(false);
  protected readonly hasMore = signal(true);
  protected readonly showScrollTop = signal(false);
  private offset = 0;
  private readonly PAGE_SIZE = 25;
  private searchTimeout: any;

  @ViewChild('scrollSentinel') sentinel?: ElementRef<HTMLElement>;
  private observer?: IntersectionObserver;

  protected readonly mode = signal<FeedMode>('forYou');
  protected readonly proximityCoords = signal<readonly [lat: number, lng: number] | null>(null);
  protected readonly selectedCategory = signal('all');
  protected readonly searchText = signal('');
  protected readonly notificationsOpen = signal(false);
  protected readonly hood = this.store.selectSignal(selectHood);
  private readonly destroy$ = new Subject<void>();

  protected readonly categories = computed(() => [
    'all',
    ...Array.from(new Set(this.posts().map((post) => post.tag).filter(t => t && t !== 'bulletin'))).sort(),
  ]);

  protected readonly visiblePosts = computed(() => {
    const category = this.selectedCategory();

    return [...this.posts()]
      .filter((post) => {
        if (post.tag === 'bulletin') return false;
        if (this.social.isHidden(post)) return false;
        if (category !== 'all' && post.tag !== category) return false;
        if (this.mode() === 'saved' && !this.social.isSaved(post)) return false;
        return true;
      })
      .sort((a, b) => {
        if (this.mode() === 'nearby') {
          return this.distanceFromProximityOrigin(a) - this.distanceFromProximityOrigin(b);
        }

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  });

  ngOnInit(): void {
    this.loadPosts();
    this.tagRepo.liveTags()
      .pipe(takeUntil(this.destroy$))
      .subscribe((post) => {
        this.posts.update((posts) => [post, ...posts.filter((item) => this.postKey(item) !== this.postKey(post))]);
        this.social.addNotification(
          post.tag === 'alert' ? 'alert' : 'reply',
          post.tag === 'alert' ? 'Nearby alert' : 'New nearby post',
          post.highlight || 'A neighbor posted a new tag.',
          this.postKey(post)
        );
      });

    // Drop a post immediately if it was deleted here or on any other page.
    this.social.postDeleted$.pipe(takeUntil(this.destroy$)).subscribe((deletedKey) => {
      this.posts.update((posts) => posts.filter((p) => this.postKey(p) !== deletedKey));
    });
  }

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver !== 'undefined' && this.sentinel) {
      this.observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && this.hasMore() && !this.isLoadingMore() && !this.isLoading()) {
          this.loadMore();
        }
      }, { rootMargin: '200px' });
      this.observer.observe(this.sentinel.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected loadPosts(reset = false): void {
    if (reset) {
      this.isLoading.set(true);
      this.posts.set([]);
    } else {
      this.isLoadingMore.set(true);
    }
    this.loadError.set(false);
    
    this.tagRepo.getPaginated(this.PAGE_SIZE, this.offset, this.searchText().trim()).subscribe({
      next: (newPosts) => {
        if (reset) {
          this.posts.set(newPosts);
        } else {
          this.posts.update(p => {
            // filter out duplicates just in case
            const existingKeys = new Set(p.map(item => this.postKey(item)));
            const uniqueNew = newPosts.filter(item => !existingKeys.has(this.postKey(item)));
            return [...p, ...uniqueNew];
          });
        }
        this.hasMore.set(newPosts.length === this.PAGE_SIZE);
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      },
      error: (err) => {
        this.logger.error('Failed to load feed', err);
        this.loadError.set(true);
        this.toast.show('Could not load the feed.', 'danger');
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      },
    });
  }

  protected loadMore(): void {
    this.offset += this.PAGE_SIZE;
    this.loadPosts();
  }

  protected retryFeed(): void {
    this.offset = 0;
    this.hasMore.set(true);
    this.loadPosts(true);
  }

  protected onSearchChange(text: string): void {
    this.searchText.set(text);
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.offset = 0;
      this.hasMore.set(true);
      this.loadPosts(true);
    }, 400);
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (typeof window !== 'undefined') {
      const scrollPos = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      this.showScrollTop.set(scrollPos > 400);
    }
  }

  protected scrollToTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  protected async setMode(mode: FeedMode): Promise<void> {
    this.mode.set(mode);
    if (mode !== 'nearby') return;

    const coords = await this.shared.getDeviceCoordinates();
    this.proximityCoords.set(coords ?? [this.hood().coords.lat, this.hood().coords.lng]);
    if (!coords) {
      this.toast.show('Sorting nearby from your current hood because location permission was unavailable.', 'info');
    }
  }

  protected createPost(): void {
    void this.router.navigate([AppRoute.Post]);
  }

  protected setCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  protected requestPushPermission(): void {
    this.social.requestPushPermission();
    this.toast.show('Notification preference updated.', 'success');
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

  protected async deletePost(post: Tag): Promise<void> {
    const deleted = await this.social.confirmAndDeletePost(post);
    if (deleted) {
      this.posts.update((posts) => posts.filter((p) => this.postKey(p) !== this.postKey(post)));
    }
  }

  // --- Polls ---

  votePoll(post: Tag, optionIndex: number): void {
    const key = this.postKey(post);
    this.social.votePoll(key, optionIndex);
    this.toast.show('Vote recorded!', 'success');
  }

  hasVotedPoll(post: Tag, optionIndex: number): boolean {
    return this.social.hasVotedPoll(this.postKey(post), optionIndex);
  }

  getPollPercentage(post: Tag, optionIndex: number): number {
    const total = this.social.totalPollVotes(this.postKey(post));
    if (total === 0) return 0;
    const votes = this.social.getPollVotes(this.postKey(post));
    const optKey = optionIndex.toString();
    const count = votes[optKey] ? votes[optKey].length : 0;
    return Math.round((count / total) * 100);
  }

  private slugFor(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'nearby';
  }

  private distanceFromProximityOrigin(post: Tag): number {
    const [lat, lng] = this.proximityCoords() ?? [this.hood().coords.lat, this.hood().coords.lng];
    return Math.pow(post.lat - lat, 2) + Math.pow(post.lng - lng, 2);
  }
}
