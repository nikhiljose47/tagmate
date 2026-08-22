import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PostTemplateDefinition } from '../../data/post-template-registry';
import { PostTemplateRegistryService } from '../../services/post-template-registry.service';

/**
 * Template picker for business posts.
 *
 * Shows recommended templates prominently, with a "More post types" toggle
 * that reveals the full catalogue for the business category.
 */
@Component({
  selector: 'app-business-template-picker',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="picker">
      <h1 class="picker-title">What are you posting?</h1>
      <p class="picker-subtitle">Pick a post type and we'll set it up for you.</p>

      @if (recommended().length) {
        <div class="picker-grid">
          @for (tpl of recommended(); track tpl.id) {
            <button
              type="button"
              class="picker-card"
              [class.picker-card--active]="selectedId() === tpl.id"
              (click)="select(tpl)"
            >
              <span class="picker-card-icon">{{ tpl.icon || '📝' }}</span>
              <span class="picker-card-body">
                <strong>{{ tpl.label }}</strong>
                @if (tpl.shortDescription) {
                  <small>{{ tpl.shortDescription }}</small>
                }
              </span>
              <i class="bi bi-chevron-right picker-card-caret" aria-hidden="true"></i>
            </button>
          }
        </div>
      }

      @if (moreTemplates().length) {
        @if (!showMore()) {
          <button type="button" class="picker-expand" (click)="showMore.set(true)">
            <i class="bi bi-grid-3x3-gap" aria-hidden="true"></i>
            More post types ({{ moreTemplates().length }})
            <i class="bi bi-chevron-down" aria-hidden="true"></i>
          </button>
        } @else {
          <button type="button" class="picker-expand" (click)="showMore.set(false)">
            <i class="bi bi-grid-3x3-gap" aria-hidden="true"></i>
            Fewer post types
            <i class="bi bi-chevron-up" aria-hidden="true"></i>
          </button>
          <div class="picker-grid picker-grid--more">
            @for (tpl of moreTemplates(); track tpl.id) {
              <button
                type="button"
                class="picker-card"
                [class.picker-card--active]="selectedId() === tpl.id"
                (click)="select(tpl)"
              >
                <span class="picker-card-icon">{{ tpl.icon || '📝' }}</span>
                <span class="picker-card-body">
                  <strong>{{ tpl.label }}</strong>
                  @if (tpl.shortDescription) {
                    <small>{{ tpl.shortDescription }}</small>
                  }
                </span>
                <i class="bi bi-chevron-right picker-card-caret" aria-hidden="true"></i>
              </button>
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    .picker {
      padding: 18px;
    }

    .picker-title {
      margin: 0 0 6px;
      color: var(--tm-text);
      font-size: 22px;
      font-weight: 800;
      line-height: 1.2;
    }

    .picker-subtitle {
      margin: 0 0 18px;
      color: var(--tm-muted);
      font-size: 13px;
    }

    .picker-grid {
      display: grid;
      gap: 8px;
    }

    .picker-grid--more {
      margin-top: 8px;
    }

    .picker-card {
      display: grid;
      grid-template-columns: 40px 1fr 20px;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 12px 14px;
      border: 1px solid var(--tm-border);
      border-radius: 8px;
      background: var(--tm-surface);
      color: var(--tm-text);
      text-align: left;
      cursor: pointer;
      transition:
        border-color 0.15s,
        background 0.15s;
      -webkit-tap-highlight-color: transparent;

      &:hover,
      &:focus-visible {
        border-color: #0f766e;
        background: color-mix(in srgb, #0f766e 5%, var(--tm-surface));
        outline: none;
      }

      &.picker-card--active {
        border-color: #0f766e;
        background: color-mix(in srgb, #0f766e 8%, var(--tm-surface));
      }
    }

    .picker-card-icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: color-mix(in srgb, #0f766e 12%, var(--tm-surface));
      font-size: 18px;
    }

    .picker-card-body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;

      strong {
        font-size: 14px;
      }
      small {
        color: var(--tm-muted);
        font-size: 12px;
        line-height: 1.35;
      }
    }

    .picker-card-caret {
      color: var(--tm-muted);
      font-size: 14px;
    }

    .picker-expand {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 14px;
      padding: 8px 0;
      border: 0;
      background: transparent;
      color: #0f766e;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;

      &:hover {
        text-decoration: underline;
      }
    }

    @media (max-width: 520px) {
      .picker {
        padding: 18px 14px;
      }
      .picker-title {
        font-size: 20px;
      }
    }
  `,
})
export class BusinessPostTemplatePickerComponent {
  readonly category = input.required<string>();
  readonly templateSelected = output<PostTemplateDefinition>();

  private readonly registry = inject(PostTemplateRegistryService);

  /** Currently highlighted (last tapped) template — visual feedback only. */
  readonly selectedId = signal<string | null>(null);
  readonly showMore = signal(false);

  readonly recommended = computed(() => this.registry.getRecommendedTemplates(this.category()));

  readonly allTemplates = computed(() => this.registry.getTemplatesForCategory(this.category()));

  /** Templates not in the recommended list. */
  readonly moreTemplates = computed(() => {
    const recIds = new Set(this.recommended().map((t) => t.id));
    return this.allTemplates().filter((t) => !recIds.has(t.id));
  });

  select(template: PostTemplateDefinition): void {
    this.selectedId.set(template.id);
    this.templateSelected.emit(template);
  }
}
