import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Tag } from '../../models/tag.model';
import { SupabaseService } from '../../services/supabase.service';
import { TagRow, rowToTag } from '../../services/tag.mapper';
import { SharedStateService } from '../../services/shared-state.service';
import { ToastService } from '../../services/toast.service';

type DateRange = '' | '1h' | '24h' | '7d' | '30d';
type SortMode = 'newest' | 'oldest' | 'nearby';

@Component({
  selector: 'tag-explorer',
  imports: [CommonModule, FormsModule],
  templateUrl: './tag-explorer.html',
  styleUrl: './tag-explorer.scss',
})
export class TagExplorer implements OnInit {
  private readonly router = inject(Router);
  private readonly shared = inject(SharedStateService);
  private readonly toast = inject(ToastService);
  private readonly supabase = inject(SupabaseService);

  cards: Tag[] = [];
  isLoading = true;
  allTags: string[] = [];
  selectedTags: string[] = [];
  selectedRange: DateRange = '';
  selectedMonth = '';
  tagSearch = '';
  sortMode: SortMode = 'newest';
  filtersOpen = signal(true);
  savedView = signal(false);
  likedCards = signal(new Set<string>());
  savedCards = signal(new Set<string>());

  ngOnInit(): void {
    this.supabase.getRows<TagRow>('tags').subscribe(({ data }) => {
      this.cards = (data ?? []).map(rowToTag);
      this.allTags = Array.from(new Set(this.cards.map((card) => card.tag).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b)
      );
      this.isLoading = false;
    });
  }

  get visibleCards(): Tag[] {
    const filtered = this.cards.filter((card) => this.matchesTags(card) && this.matchesDate(card));

    return [...filtered].sort((a, b) => {
      if (this.sortMode === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      if (this.sortMode === 'nearby') {
        return Math.abs(a.lat) + Math.abs(a.lng) - (Math.abs(b.lat) + Math.abs(b.lng));
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  refresh(): void {
    this.supabase.getRows<TagRow>('tags').subscribe(({ data }) => {
      this.cards = (data ?? []).map(rowToTag);
      this.toast.show('Globe feed refreshed.', 'success');
    });
  }

  toggleFilters(): void {
    this.filtersOpen.update((value) => !value);
  }

  saveView(): void {
    this.savedView.update((value) => !value);
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
    this.toast.show(this.savedCards().has(key) ? 'Post saved.' : 'Post removed from saved.', 'success');
  }

  comment(card: Tag): void {
    this.toast.show(`Comments for "${card.highlight || 'this post'}" are coming soon.`, 'info');
  }

  async shareCard(card: Tag): Promise<void> {
    await this.shareText('Tagmate post', card.highlight || 'Check out this Tagmate post.');
  }

  report(card: Tag): void {
    this.toast.show(`Thanks. "${card.highlight || 'Post'}" has been flagged for review.`, 'warning');
  }

  openOnMap(card: Tag): void {
    this.shared.updateCoordinates(card.lat, card.lng);
    this.shared.updateText(card.highlight || card.hoodId || 'Selected post');
    void this.router.navigate(['/hood']);
  }

  filteredTags(): string[] {
    const q = this.tagSearch.trim().toLowerCase();
    return this.allTags.filter((tag) => tag.toLowerCase().includes(q));
  }

  toggleTag(tag: string): void {
    if (this.selectedTags.includes(tag)) {
      this.removeTag(tag);
      return;
    }

    if (this.selectedTags.length < 2) {
      this.selectedTags = [...this.selectedTags, tag];
      this.tagSearch = '';
    }
  }

  removeTag(tag: string): void {
    this.selectedTags = this.selectedTags.filter((selected) => selected !== tag);
  }

  clearFilters(): void {
    this.selectedTags = [];
    this.selectedRange = '';
    this.selectedMonth = '';
    this.tagSearch = '';
  }

  cardKey(card: Tag): string {
    return card.id ?? `${card.userId}-${card.createdAt}`;
  }

  private toggleSet(setSignal: ReturnType<typeof signal<Set<string>>>, key: string): void {
    setSignal.update((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  private async shareText(title: string, text: string): Promise<void> {
    const url = typeof window !== 'undefined' ? window.location.href : '';

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }

      await navigator.clipboard?.writeText(`${text} ${url}`.trim());
      this.toast.show('Share link copied.', 'success');
    } catch {
      this.toast.show('Share was cancelled.', 'info');
    }
  }

  onRangeChange(): void {
    if (this.selectedRange) {
      this.selectedMonth = '';
    }
  }

  onMonthChange(): void {
    if (this.selectedMonth) {
      this.selectedRange = '';
    }
  }

  private matchesTags(card: Tag): boolean {
    if (!this.selectedTags.length) return true;
    return this.selectedTags.includes(card.tag);
  }

  private matchesDate(card: Tag): boolean {
    const created = new Date(card.createdAt);
    if (Number.isNaN(created.getTime())) return false;

    if (this.selectedMonth) {
      return card.createdAt.slice(0, 7) === this.selectedMonth;
    }

    if (!this.selectedRange) return true;

    const rangeMs: Record<Exclude<DateRange, ''>, number> = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    return Date.now() - created.getTime() <= rangeMs[this.selectedRange];
  }
}
