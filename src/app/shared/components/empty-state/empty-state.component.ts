import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'tm-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state" role="status" [attr.aria-label]="title">
      <div class="empty-icon">{{ icon }}</div>
      <p class="empty-title">{{ title }}</p>
      <p class="empty-sub">{{ subtitle }}</p>
      @if (actionText) {
        <button class="empty-action" type="button" (click)="actionClicked.emit()">
          {{ actionText }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      .empty-state {
        display: grid;
        justify-items: center;
        gap: 8px;
        margin: 8px 0;
        padding: 42px 24px;
        text-align: center;
        border: 1px solid color-mix(in srgb, var(--tm-border, #e2e8f0) 80%, transparent);
        border-radius: var(--tm-radius, 18px);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--tm-surface, #fff) 92%, transparent),
            color-mix(in srgb, var(--tm-primary, #6366f1) 6%, var(--tm-surface, #fff))
          ),
          var(--tm-surface, #fff);
        box-shadow: var(--tm-shadow-sm, 0 10px 30px rgba(15, 23, 42, 0.08));
        backdrop-filter: blur(16px);
      }
      .empty-icon {
        width: 64px;
        height: 64px;
        display: grid;
        place-items: center;
        margin-bottom: 4px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--tm-primary, #6366f1) 12%, transparent);
        color: var(--tm-primary-text, #4338ca);
        font-size: 34px;
        animation: empty-pulse 2.4s ease-in-out infinite;
      }
      .empty-title {
        margin: 0;
        font-size: 17px;
        font-weight: 800;
        color: var(--tm-text, #334155);
      }
      .empty-sub {
        max-width: 34ch;
        margin: 0;
        font-size: 14px;
        color: var(--tm-muted, #94a3b8);
        line-height: 1.45;
      }
      .empty-action {
        min-height: 38px;
        margin-top: 8px;
        border: 0;
        border-radius: 999px;
        background: var(--tm-primary, #6366f1);
        padding: 0 16px;
        color: #fff;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 8px 20px color-mix(in srgb, var(--tm-primary, #6366f1) 24%, transparent);
      }
      @keyframes empty-pulse {
        0%,
        100% {
          transform: scale(1);
          box-shadow: 0 0 0 0 color-mix(in srgb, var(--tm-primary, #6366f1) 18%, transparent);
        }
        50% {
          transform: scale(1.04);
          box-shadow: 0 0 0 12px transparent;
        }
      }
    `,
  ],
})
export class EmptyStateComponent {
  @Input() icon = '!';
  @Input() title = 'Nothing here yet';
  @Input() subtitle = '';
  @Input() actionText = '';
  @Output() actionClicked = new EventEmitter<void>();
}
