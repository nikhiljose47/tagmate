import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { Utils } from '../../services/utils';
import { TagForm } from '../tag-form/tag-form';

@Component({
  selector: 'tag-explorer',
  imports: [CommonModule, TagForm],
  templateUrl: './tag-explorer.html',
  styleUrl: './tag-explorer.scss',
})
export class TagExplorer {
  cards: any[] = [];
  showTagForm = signal(false);

  constructor(private utils: Utils) {}

  ngOnInit() {
    this.utils.cards$.subscribe(data => this.cards = data);
  }

  onClick(){
    this.showTagForm.update(v => !v);
  }
}
