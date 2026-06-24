import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Tag } from '../../models/tag.model';
import markersData from '../../data/tags.json';

type DateRange = '' | '1h' | '24h' | '7d' | '30d';

@Component({
  selector: 'tag-explorer',
  imports: [CommonModule, FormsModule],
  templateUrl: './tag-explorer.html',
  styleUrl: './tag-explorer.scss',
})
export class TagExplorer implements OnInit {
  cards: Tag[] = [];
  isLoading = true;
  allTags: string[] = [];
  selectedTags: string[] = [];
  selectedRange: DateRange = '';
  selectedMonth = '';
  tagSearch = '';

  ngOnInit(): void {
    this.cards = markersData as Tag[];
    this.allTags = Array.from(new Set(this.cards.map((card) => card.tag).filter(Boolean))).sort(
      (a, b) => a.localeCompare(b)
    );
    this.isLoading = false;
  }

  get visibleCards(): Tag[] {
    return this.cards.filter((card) => this.matchesTags(card) && this.matchesDate(card));
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
