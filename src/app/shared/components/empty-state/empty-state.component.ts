import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'tm-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state" role="status" [attr.aria-label]="title">
      <div class="empty-icon">
        @if (isIconClass(icon)) {
          <i class="bi" [class]="icon"></i>
        } @else {
          {{ icon }}
        }
      </div>
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
        border: 1px solid var(--tm-border-subtle, #e8edf3);
        border-radius: var(--tm-radius-lg, 12px);
        background: var(--tm-surface, #fff);
        box-shadow: var(--tm-shadow-sm);
      }
      .empty-icon {
        width: 56px;
        height: 56px;
        display: grid;
        place-items: center;
        margin-bottom: 4px;
        border-radius: var(--tm-radius-lg, 12px);
        background: var(--tm-primary-subtle, color-mix(in srgb, #6366f1 10%, transparent));
        color: var(--tm-primary-text, #4338ca);
        font-size: 28px;
      }
      .empty-title {
        margin: 0;
        font-size: 16px;
        font-weight: var(--tm-fw-bold, 700);
        color: var(--tm-text, #334155);
      }
      .empty-sub {
        max-width: 34ch;
        margin: 0;
        font-size: 14px;
        color: var(--tm-muted, #94a3b8);
        line-height: 1.5;
      }
      .empty-action {
        height: var(--tm-control-h-md, 38px);
        margin-top: 10px;
        border: 0;
        border-radius: var(--tm-radius-full, 999px);
        background: var(--tm-primary, #6366f1);
        padding: 0 20px;
        color: #fff;
        font-size: 13px;
        font-weight: var(--tm-fw-semibold, 600);
        cursor: pointer;
        transition: background-color 0.15s;

        &:hover {
          background: var(--tm-primary-hover, #4f46e5);
        }

        &:focus-visible {
          outline: none;
          box-shadow: var(--tm-focus-ring);
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

  isIconClass(str: string): boolean {
    return !!str && (str.startsWith('bi-') || str.startsWith('bi '));
  }
}
