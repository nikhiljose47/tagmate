import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Tag } from '../../../../core/models/tag.model';
import { TAG_REPOSITORY } from '../../../../core/repositories/repository.tokens';
import { SharedStateService } from '../../../../core/services/shared-state.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { AppRoute } from '../../../../core/enums/route.enum';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import { TagGradientPipe } from '../../../../shared/pipes/tag-gradient.pipe';
import { TagEmojiPipe } from '../../../../shared/pipes/tag-emoji.pipe';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

type DateRange = '' | '1h' | '24h' | '7d' | '30d';
type SortMode  = 'newest' | 'oldest' | 'nearby';

@Component({
  selector: 'app-globe',
  standalone: true,
  imports: [CommonModule, FormsModule, TimeAgoPipe, TagGradientPipe, TagEmojiPipe, AvatarComponent, EmptyStateComponent],
  templateUrl: './globe.html',
  styleUrl: './globe.scss',
})
export class GlobePage implements OnInit {
  private readonly router   = inject(Router);
  private readonly shared   = inject(SharedStateService);
  private readonly toast    = inject(ToastService);
  private readonly logger   = inject(LoggerService);
  private readonly tagRepo  = inject(TAG_REPOSITORY);

  cards: Tag[]        = [];
  isLoading           = true;
  allTags: string[]   = [];
  selectedTags: string[] = [];
  selectedRange: DateRange = '';
  selectedMonth       = '';
  tagSearch           = '';
  sortMode: SortMode  = 'newest';

  filtersOpen  = signal(false);
  savedView    = signal(false);
  likedCards   = signal(new Set<string>());
  savedCards   = signal(new Set<string>());
  brokenImages = new Set<string>();

  ngOnInit(): void {
    this.tagRepo.getAll().subscribe({
      next: (tags) => {
        this.cards   = tags;
        this.allTags = Array.from(new Set(tags.map((c) => c.tag).filter(Boolean))).sort((a, b) => a.localeCompare(b));
        this.isLoading = false;
      },
      error: (err) => {
        this.logger.error('Failed to load tags', err);
        this.isLoading = false;
        this.toast.show('Could not load posts. Please try again.', 'danger');
      },
    });
  }

  get visibleCards(): Tag[] {
    const filtered = this.cards.filter((c) => this.matchesTags(c) && this.matchesDate(c));
    return [...filtered].sort((a, b) => {
      if (this.sortMode === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (this.sortMode === 'nearby') return Math.abs(a.lat) + Math.abs(a.lng) - (Math.abs(b.lat) + Math.abs(b.lng));
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  hasBanner(card: Tag): boolean {
    return !card.images?.[0] || this.brokenImages.has(this.cardKey(card));
  }

  onImgError(card: Tag): void {
    this.brokenImages = new Set([...this.brokenImages, this.cardKey(card)]);
  }

  refresh(): void {
    this.isLoading = true;
    this.tagRepo.getAll().subscribe({
      next: (tags) => {
        this.cards = tags;
        this.isLoading = false;
        this.toast.show('Feed refreshed.', 'success');
      },
      error: (err) => {
        this.logger.error('Refresh failed', err);
        this.isLoading = false;
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
    this.toggleSet(this.likedCards, this.cardKey(card));
  }

  toggleSave(card: Tag): void {
    const key = this.cardKey(card);
    this.toggleSet(this.savedCards, key);
    this.toast.show(this.savedCards().has(key) ? 'Post saved.' : 'Removed from saved.', 'success');
  }

  comment(_card: Tag): void { this.toast.show('Comments coming soon.', 'info'); }

  async shareCard(card: Tag): Promise<void> {
    await this.shareText('Tagmate post', card.highlight || 'Check out this Tagmate post.');
  }

  report(_card: Tag): void { this.toast.show('Post flagged for review.', 'warning'); }

  openOnMap(card: Tag): void {
    this.shared.updateCoordinates(card.lat, card.lng);
    this.shared.updateText(card.highlight || card.hoodId || 'Selected post');
    void this.router.navigate([AppRoute.Hood]);
  }

  filteredTags(): string[] {
    const q = this.tagSearch.trim().toLowerCase();
    return this.allTags.filter((t) => t.toLowerCase().includes(q));
  }

  toggleTag(tag: string): void {
    if (this.selectedTags.includes(tag)) { this.removeTag(tag); return; }
    if (this.selectedTags.length < 2) { this.selectedTags = [...this.selectedTags, tag]; this.tagSearch = ''; }
  }

  removeTag(tag: string): void { this.selectedTags = this.selectedTags.filter((s) => s !== tag); }

  clearFilters(): void {
    this.selectedTags  = [];
    this.selectedRange = '';
    this.selectedMonth = '';
    this.tagSearch     = '';
  }

  cardKey(card: Tag): string { return card.id ?? `${card.userId}-${card.createdAt}`; }

  onRangeChange(): void { if (this.selectedRange) this.selectedMonth = ''; }
  onMonthChange(): void { if (this.selectedMonth) this.selectedRange = ''; }

  private toggleSet(setSignal: ReturnType<typeof signal<Set<string>>>, key: string): void {
    setSignal.update((cur) => {
      const next = new Set(cur);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

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
    if (!this.selectedTags.length) return true;
    return this.selectedTags.includes(card.tag);
  }

  private matchesDate(card: Tag): boolean {
    const created = new Date(card.createdAt);
    if (Number.isNaN(created.getTime())) return false;
    if (this.selectedMonth) return card.createdAt.slice(0, 7) === this.selectedMonth;
    if (!this.selectedRange) return true;
    const rangeMs: Record<Exclude<DateRange, ''>, number> = {
      '1h': 3_600_000, '24h': 86_400_000, '7d': 604_800_000, '30d': 2_592_000_000,
    };
    return Date.now() - created.getTime() <= rangeMs[this.selectedRange];
  }
}
