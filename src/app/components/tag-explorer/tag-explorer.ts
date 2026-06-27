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
  filtersOpen = signal(false);
  savedView = signal(false);
  likedCards = signal(new Set<string>());
  savedCards = signal(new Set<string>());
  brokenImages = new Set<string>();

  private readonly TAG_COLORS: Record<string, [string, string]> = {
    news: ['#3b82f6', '#1d4ed8'],
    weather: ['#06b6d4', '#0284c7'],
    food: ['#f97316', '#c2410c'],
    event: ['#8b5cf6', '#6d28d9'],
    alert: ['#ef4444', '#b91c1c'],
    fitness: ['#22c55e', '#15803d'],
    shopping: ['#ec4899', '#be185d'],
    business: ['#6366f1', '#4338ca'],
    tech: ['#14b8a6', '#0f766e'],
    health: ['#84cc16', '#4d7c0f'],
    art: ['#f59e0b', '#b45309'],
    sports: ['#0ea5e9', '#0369a1'],
    environment: ['#10b981', '#065f46'],
    market: ['#f43f5e', '#be123c'],
    entertainment: ['#a855f7', '#7e22ce'],
    startup: ['#6366f1', '#312e81'],
    network: ['#64748b', '#334155'],
    utility: ['#78716c', '#44403c'],
    traffic: ['#fb923c', '#c2410c'],
    sale: ['#4ade80', '#15803d'],
  };

  private readonly TAG_EMOJIS: Record<string, string> = {
    news: '📰', weather: '⛅', food: '🍜', event: '🎉', alert: '⚠️',
    fitness: '💪', shopping: '🛍️', business: '🏢', tech: '💻', health: '🏥',
    art: '🎨', sports: '⚽', environment: '🌿', market: '🏪', entertainment: '🎭',
    startup: '🚀', network: '🔗', utility: '🔧', traffic: '🚦', sale: '💰',
  };

  private readonly AVATAR_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
    '#22c55e', '#06b6d4', '#f59e0b', '#3b82f6',
  ];

  ngOnInit(): void {
    this.supabase.getRows<TagRow>('tags').subscribe(({ data }) => {
      this.cards = (data ?? []).map(rowToTag);
      this.allTags = Array.from(new Set(this.cards.map((c) => c.tag).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b)
      );
      this.isLoading = false;
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

  timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  }

  tagGradient(tag: string): string {
    const [from, to] = this.TAG_COLORS[tag] ?? ['#6366f1', '#4f46e5'];
    return `linear-gradient(135deg, ${from}, ${to})`;
  }

  tagEmoji(tag: string): string {
    return this.TAG_EMOJIS[tag] ?? '📌';
  }

  avatarBg(username: string): string {
    let hash = 0;
    for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
    return this.AVATAR_COLORS[Math.abs(hash) % this.AVATAR_COLORS.length];
  }

  avatarInitials(username: string): string {
    const parts = username.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return username.trim().slice(0, 2).toUpperCase() || '??';
  }

  hasBanner(card: Tag): boolean {
    return !card.images?.[0] || this.brokenImages.has(this.cardKey(card));
  }

  onImgError(card: Tag): void {
    this.brokenImages = new Set([...this.brokenImages, this.cardKey(card)]);
  }

  refresh(): void {
    this.isLoading = true;
    this.supabase.getRows<TagRow>('tags').subscribe(({ data }) => {
      this.cards = (data ?? []).map(rowToTag);
      this.isLoading = false;
      this.toast.show('Feed refreshed.', 'success');
    });
  }

  toggleFilters(): void {
    this.filtersOpen.update((v) => !v);
  }

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

  comment(card: Tag): void {
    this.toast.show('Comments coming soon.', 'info');
  }

  async shareCard(card: Tag): Promise<void> {
    await this.shareText('Tagmate post', card.highlight || 'Check out this Tagmate post.');
  }

  report(card: Tag): void {
    this.toast.show('Post flagged for review.', 'warning');
  }

  openOnMap(card: Tag): void {
    this.shared.updateCoordinates(card.lat, card.lng);
    this.shared.updateText(card.highlight || card.hoodId || 'Selected post');
    void this.router.navigate(['/hood']);
  }

  filteredTags(): string[] {
    const q = this.tagSearch.trim().toLowerCase();
    return this.allTags.filter((t) => t.toLowerCase().includes(q));
  }

  toggleTag(tag: string): void {
    if (this.selectedTags.includes(tag)) { this.removeTag(tag); return; }
    if (this.selectedTags.length < 2) { this.selectedTags = [...this.selectedTags, tag]; this.tagSearch = ''; }
  }

  removeTag(tag: string): void {
    this.selectedTags = this.selectedTags.filter((s) => s !== tag);
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
    } catch { this.toast.show('Share cancelled.', 'info'); }
  }

  onRangeChange(): void { if (this.selectedRange) this.selectedMonth = ''; }
  onMonthChange(): void { if (this.selectedMonth) this.selectedRange = ''; }

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
      '1h': 3600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000,
    };
    return Date.now() - created.getTime() <= rangeMs[this.selectedRange];
  }
}
