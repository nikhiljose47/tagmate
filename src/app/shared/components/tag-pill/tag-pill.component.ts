import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { tagEmoji } from '../../utils/color.utils';

@Component({
  selector: 'tm-tag-pill',
  standalone: true,
  imports: [TitleCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="tm-tag-pill" [attr.aria-label]="tag + ' category'">
      {{ emoji }} {{ tag | titlecase }}
    </span>
  `,
  styles: [`
    .tm-tag-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 10px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 700;
      background: rgba(99,102,241,0.1);
      color: #6366f1;
      white-space: nowrap;
    }
  `],
})
export class TagPillComponent {
  @Input({ required: true }) tag!: string;
  get emoji(): string { return tagEmoji(this.tag); }
}
