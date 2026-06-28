import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'tm-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state" role="status" [attr.aria-label]="title">
      <div class="empty-icon">{{ icon }}</div>
      <p class="empty-title">{{ title }}</p>
      <p class="empty-sub">{{ subtitle }}</p>
    </div>
  `,
  styles: [`
    .empty-state {
      padding: 56px 24px;
      text-align: center;
    }
    .empty-icon { font-size: 48px; margin-bottom: 12px; }
    .empty-title { margin: 0 0 6px; font-size: 16px; font-weight: 700; color: #334155; }
    .empty-sub { margin: 0; font-size: 14px; color: #94a3b8; }
  `],
})
export class EmptyStateComponent {
  @Input() icon = '📭';
  @Input() title = 'Nothing here yet';
  @Input() subtitle = '';
}
