import { CommonModule } from '@angular/common';
import { Utils } from '../../services/utils';
import { FormsModule } from '@angular/forms';
import { Component } from '@angular/core';

@Component({
  selector: 'tag-explorer',
  imports: [CommonModule, FormsModule],
  templateUrl: './tag-explorer.html',
  styleUrl: './tag-explorer.scss',
})
export class TagExplorer {
  cards: any[] = [];
  allTags = ['News', 'Event', 'Alert', 'Info', 'Update'];
  selectedTags: string[] = [];
  selectedRange = '';
  selectedMonth = new Date().toISOString().slice(0, 7); // default current month
  tagSearch = '';



  filteredTags() {
    const q = this.tagSearch.toLowerCase();
    return this.allTags.filter(t => t.toLowerCase().includes(q));
  }

  toggleTag(tag: string) {
    if (this.selectedTags.includes(tag)) {
      this.selectedTags = this.selectedTags.filter(t => t !== tag);
    } else if (this.selectedTags.length < 2) {
      this.selectedTags.push(tag);
    }
  }

  removeTag(tag: string) {
    this.selectedTags = this.selectedTags.filter(t => t !== tag);
  }



  onRangeChange() {
    if (this.selectedRange) {
      // clear month if range selected
      this.selectedMonth = '';
    } else {
      // reset to current month if range cleared
      this.selectedMonth = new Date().toISOString().slice(0, 7);
    }
  }

  onMonthChange() {
    if (this.selectedMonth) {
      // clear range if month selected
      this.selectedRange = '';
    }
  }

  constructor(private utils: Utils) {
  }

  ngOnInit() {
    this.utils.cards$.subscribe(data => this.cards = data);
  }

  handleFormSubmit(data: any) {
    console.log('📍 Received Tag Data:', data);
    this.cards[0] = data;
  }
}
