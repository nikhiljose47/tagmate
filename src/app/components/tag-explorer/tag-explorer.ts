import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Utils } from '../../services/utils';

@Component({
  selector: 'tag-explorer',
  imports: [CommonModule],
  templateUrl: './tag-explorer.html',
  styleUrl: './tag-explorer.scss',
})
export class TagExplorer {
  cards: any[] = [];

  constructor(private utils: Utils) {}

  ngOnInit() {
    this.utils.cards$.subscribe(data => this.cards = data);
  }
}
