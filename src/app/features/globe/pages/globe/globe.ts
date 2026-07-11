import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { Tag } from '../../../../core/models/tag.model';
import { TAG_REPOSITORY } from '../../../../core/repositories/repository.tokens';
import { SharedStateService } from '../../../../core/services/shared-state.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { AppRoute } from '../../../../core/enums/route.enum';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import { TagEmojiPipe } from '../../../../shared/pipes/tag-emoji.pipe';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PreloadService } from '../../../../core/services/preload.service';
import { SocialInteractionsService } from '../../../../core/services/social-interactions.service';
import { selectHood } from '../../../../store/user-preferences/user-preference.selectors';
import { PostMenuComponent } from '../../../../shared/components/post-menu/post-menu.component';

type DateRange = '' | '1h' | '24h' | '7d' | '30d';
type SortMode  = 'newest' | 'oldest' | 'nearby';

@Component({
  selector: 'app-globe',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TimeAgoPipe, TagEmojiPipe, AvatarComponent, EmptyStateComponent, PostMenuComponent],
  templateUrl: './globe.html',
  styleUrl: './globe.scss',
})
export class GlobePage implements OnInit {
  private readonly router   = inject(Router);
  private readonly shared   = inject(SharedStateService);
  private readonly toast    = inject(ToastService);
  private readonly logger   = inject(LoggerService);
  private readonly tagRepo  = inject(TAG_REPOSITORY);
  private readonly preload  = inject(PreloadService);
  private readonly store    = inject(Store);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly social = inject(SocialInteractionsService);

  cards           = signal<Tag[]>([]);
  isLoading       = signal(true);
  allTags         = signal<string[]>([]);
  selectedTags    = signal<string[]>([]);
  selectedRange   = signal<DateRange>('');
  selectedMonth   = signal<string>('');
  tagSearch       = signal<string>('');
  sortMode        = signal<SortMode>('newest');
  proximityCoords = signal<readonly [lat: number, lng: number] | null>(null);

  filtersOpen  = signal(false);
  savedView    = signal(false);
  brokenImages = signal<Set<string>>(new Set<string>());
  protected readonly hood = this.store.selectSignal(selectHood);
  readonly currentTimestamp = signal<number>(Date.now());
  private timeUpdateInterval?: any;

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.timeUpdateInterval = setInterval(() => {
        this.currentTimestamp.set(Date.now());
      }, 30000);
    }
    this.destroyRef.onDestroy(() => {
      if (this.timeUpdateInterval) {
        clearInterval(this.timeUpdateInterval);
      }
    });

    // Drop a post immediately if it was deleted here or on any other page.
    // Registered unconditionally, before the preload-cache early return below.
    this.social.postDeleted$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((deletedKey) => {
      this.cards.update((curr) => curr.filter((c) => this.cardKey(c) !== deletedKey));
    });

    // Use preloaded data immediately if available — avoids a network round-trip on first visit.
    const cached = this.preload.getGlobePosts();
    if (cached) {
      this.setCards(cached);
      this.isLoading.set(false);
      return;
    }

    this.tagRepo.getFiltered({ excludeTag: 'bulletin' }).subscribe({
      next: (tags) => {
        this.setCards(tags);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.logger.error('Failed to load tags', err);
        this.isLoading.set(false);
        this.toast.show('Could not load posts. Please try again.', 'danger');
      },
    });
  }

  private setCards(tags: Tag[]): void {
    this.cards.set(tags);
    this.allTags.set(Array.from(new Set(tags.map((c) => c.tag).filter(t => t && t !== 'bulletin'))).sort((a, b) => a.localeCompare(b)));
  }

  readonly visibleCards = computed<Tag[]>(() => {
    const filtered = this.cards().filter((c) => c.tag !== 'bulletin' && !this.social.isHidden(c) && this.matchesTags(c) && this.matchesDate(c));
    return [...filtered].sort((a, b) => {
      if (this.sortMode() === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (this.sortMode() === 'nearby') return this.distanceFromProximityOrigin(a) - this.distanceFromProximityOrigin(b);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });

  hasBanner(card: Tag): boolean {
    return !card.images?.[0] || this.brokenImages().has(this.cardKey(card));
  }

  onImgError(card: Tag): void {
    this.brokenImages.update((prev) => new Set([...prev, this.cardKey(card)]));
  }

  refresh(): void {
    this.isLoading.set(true);
    this.brokenImages.set(new Set());
    this.tagRepo.getFiltered({ excludeTag: 'bulletin' }).subscribe({
      next: (tags) => {
        this.cards.set(tags);
        this.isLoading.set(false);
        this.toast.show('Feed refreshed.', 'success');
      },
      error: (err) => {
        this.logger.error('Refresh failed', err);
        this.isLoading.set(false);
      },
    });
  }

  toggleFilters(): void { this.filtersOpen.update((v) => !v); }

  saveView(): void {
    this.savedView.update((v) => !v);
    this.toast.show(this.savedView() ? 'View saved.' : 'Saved view removed.', 'success');
  }

  async shareView(): Promise<void> {
    await this.shareText('Tagmate Globe', 'Check out this Tagmate globe feed.');
  }

  toggleLike(card: Tag): void {
    this.social.toggleLike(card);
  }

  toggleSave(card: Tag): void {
    const saved = this.social.toggleSave(card);
    this.toast.show(saved ? 'Post saved.' : 'Removed from saved.', 'success');
  }

  comment(card: Tag): void { void this.router.navigate(['/posts', this.cardKey(card)]); }

  async shareCard(card: Tag): Promise<void> {
    await this.shareText('Tagmate post', card.highlight || 'Check out this Tagmate post.');
  }

  report(card: Tag): void {
    this.social.reportPost(card);
    this.toast.show('Post hidden and flagged for review.', 'warning');
  }

  async deletePost(card: Tag): Promise<void> {
    const deleted = await this.social.confirmAndDeletePost(card);
    if (deleted) this.cards.update((curr) => curr.filter((c) => this.cardKey(c) !== this.cardKey(card)));
  }

  openOnMap(card: Tag): void {
    this.shared.updateCoordinates(card.lat, card.lng);
    this.shared.updateText(card.highlight || card.hoodId || 'Selected post');
    void this.router.navigate([AppRoute.Hood]);
  }

  filteredTags(): string[] {
    const q = this.tagSearch().trim().toLowerCase();
    return this.allTags().filter((t) => t.toLowerCase().includes(q));
  }

  toggleTag(tag: string): void {
    if (this.selectedTags().includes(tag)) { this.removeTag(tag); return; }
    if (this.selectedTags().length < 2) {
      this.selectedTags.update((prev) => [...prev, tag]);
      this.tagSearch.set('');
    }
  }

  removeTag(tag: string): void {
    this.selectedTags.update((prev) => prev.filter((s) => s !== tag));
  }

  clearFilters(): void {
    this.selectedTags.set([]);
    this.selectedRange.set('');
    this.selectedMonth.set('');
    this.tagSearch.set('');
  }

  async onSortModeChange(mode: SortMode): Promise<void> {
    this.sortMode.set(mode);
    if (mode !== 'nearby') return;

    const coords = await this.shared.getDeviceCoordinates();
    const fallbackLat = this.hood()?.coords?.lat ?? 0;
    const fallbackLng = this.hood()?.coords?.lng ?? 0;
    this.proximityCoords.set(coords ?? [fallbackLat, fallbackLng]);
    if (!coords) {
      this.toast.show('Sorting nearby from your current hood because location permission was unavailable.', 'info');
    }
  }

  cardKey(card: Tag): string { return this.social.postKey(card); }

  neighborhoodSlug(card: Tag): string {
    return (card.hoodId || 'nearby')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'nearby';
  }

  onRangeChange(): void { if (this.selectedRange()) this.selectedMonth.set(''); }
  onMonthChange(): void { if (this.selectedMonth()) this.selectedRange.set(''); }

  private async shareText(title: string, text: string): Promise<void> {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) { await navigator.share({ title, text, url }); return; }
      await navigator.clipboard?.writeText(`${text} ${url}`.trim());
      this.toast.show('Link copied.', 'success');
    } catch {
      this.toast.show('Share cancelled.', 'info');
    }
  }

  private matchesTags(card: Tag): boolean {
    const selected = this.selectedTags();
    if (!selected.length) return true;
    return selected.includes(card.tag);
  }

  private matchesDate(card: Tag): boolean {
    const created = new Date(card.createdAt);
    if (Number.isNaN(created.getTime())) return false;
    const month = this.selectedMonth();
    if (month) return card.createdAt.slice(0, 7) === month;
    const range = this.selectedRange();
    if (!range) return true;
    const rangeMs: Record<Exclude<DateRange, ''>, number> = {
      '1h': 3_600_000, '24h': 86_400_000, '7d': 604_800_000, '30d': 2_592_000_000,
    };
    return this.currentTimestamp() - created.getTime() <= rangeMs[range];
  }

  private distanceFromProximityOrigin(card: Tag): number {
    const coords = this.proximityCoords() ?? [this.hood().coords.lat, this.hood().coords.lng];
    const [lat, lng] = coords;
    return Math.pow(card.lat - lat, 2) + Math.pow(card.lng - lng, 2);
  }
}
