import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PostTemplateDefinition } from '../../data/post-template-registry';

/**
 * Renders a dynamic form from a PostTemplateDefinition.
 *
 * Required fields are shown first; optional fields are hidden behind an
 * "Add more details" toggle so the initial form stays short.
 */
@Component({
  selector: 'app-template-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tpl-form">
      <div class="tpl-form-head">
        <i class="bi bi-stars" aria-hidden="true"></i>
        <span>
          <strong>{{ template().label }}</strong>
          <small>{{ template().intro }}</small>
        </span>
      </div>

      <div class="tpl-form-fields">
        @for (field of requiredFields(); track field.key) {
          <ng-container *ngTemplateOutlet="fieldTpl; context: { $implicit: field }"></ng-container>
        }
      </div>

      @if (optionalFields().length) {
        @if (!showOptional()) {
          <button type="button" class="tpl-more-toggle" (click)="showOptional.set(true)">
            <i class="bi bi-plus-circle" aria-hidden="true"></i>
            Add more details ({{ optionalFields().length }})
          </button>
        } @else {
          <button type="button" class="tpl-more-toggle" (click)="showOptional.set(false)">
            <i class="bi bi-dash-circle" aria-hidden="true"></i>
            Hide optional fields
          </button>
          <div class="tpl-form-fields tpl-form-fields--optional">
            @for (field of optionalFields(); track field.key) {
              <ng-container *ngTemplateOutlet="fieldTpl; context: { $implicit: field }"></ng-container>
            }
          </div>
        }
      }

      <p class="tpl-form-status" [class.ready]="isComplete()">
        <i class="bi"
           [class.bi-check-circle-fill]="isComplete()"
           [class.bi-pencil]="!isComplete()"
           aria-hidden="true"></i>
        {{ isComplete()
          ? 'Your post text is ready below.'
          : 'Fill the required fields to auto-generate the post.' }}
      </p>
    </div>

    <!-- Shared field template -->
    <ng-template #fieldTpl let-field>
      <label class="tpl-field">
        <span class="tpl-field-label">
          {{ field.label }}
          @if (!field.required) { <span class="tpl-field-opt">(optional)</span> }
        </span>

        @if (field.helpText) {
          <span class="tpl-field-help">{{ field.helpText }}</span>
        }

        @if (field.type === 'select') {
          <select class="tm-input"
                  [ngModel]="values()[field.key]"
                  (ngModelChange)="onFieldChange(field.key, $event)"
                  [name]="'tpl_' + field.key"
                  [required]="field.required ?? false">
            <option value="" disabled>{{ field.placeholder || 'Choose…' }}</option>
            @for (option of field.options; track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
        } @else if (field.type === 'multi-select') {
          <select class="tm-input" multiple
                  [ngModel]="splitMultiValue(values()[field.key])"
                  (ngModelChange)="onFieldChange(field.key, $any($event).join(','))"
                  [name]="'tpl_' + field.key"
                  [required]="field.required ?? false">
            @for (option of field.options; track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
        } @else if (field.type === 'textarea') {
          <textarea class="tm-input" rows="3"
                    [placeholder]="field.placeholder || ''"
                    [ngModel]="values()[field.key]"
                    (ngModelChange)="onFieldChange(field.key, $event)"
                    [name]="'tpl_' + field.key"
                    [required]="field.required ?? false"
                    [maxlength]="field.maxLength ?? 500"></textarea>
        } @else if (field.type === 'toggle') {
          <label class="tpl-toggle">
            <input type="checkbox"
                   [ngModel]="values()[field.key] === 'true'"
                   (ngModelChange)="onFieldChange(field.key, $event ? 'true' : 'false')"
                   [name]="'tpl_' + field.key" />
            <span>{{ field.placeholder || 'Yes' }}</span>
          </label>
        } @else {
          <input class="tm-input"
                 [type]="inputType(field.type)"
                 [placeholder]="field.placeholder || ''"
                 [ngModel]="values()[field.key]"
                 (ngModelChange)="onFieldChange(field.key, $event)"
                 [name]="'tpl_' + field.key"
                 [required]="field.required ?? false"
                 [min]="field.min ?? null"
                 [max]="field.max ?? null"
                 [maxlength]="field.maxLength ?? null" />
        }
      </label>
    </ng-template>
  `,
  styles: `
    .tpl-form {
      margin: 14px;
      padding: 14px;
      border: 1px solid color-mix(in srgb, #0f766e 35%, var(--tm-border));
      border-left: 3px solid #0f766e;
      border-radius: 8px;
      background: color-mix(in srgb, #0f766e 4%, var(--tm-surface));
    }

    .tpl-form-head {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 12px;
      font-size: 13px;
      font-weight: 700;
      color: var(--tm-text);

      > i { color: #0f766e; font-size: 16px; margin-top: 1px; }
      > span { display: flex; flex-direction: column; gap: 2px; }
      strong { font-size: 13px; }
      small { color: var(--tm-muted); font-size: 12px; font-weight: 500; }
    }

    .tpl-form-fields {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .tpl-form-fields--optional {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed var(--tm-border);
    }

    .tpl-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .tpl-field-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--tm-muted);
    }

    .tpl-field-opt {
      font-weight: 500;
      text-transform: none;
      letter-spacing: 0;
    }

    .tpl-field-help {
      font-size: 11px;
      color: var(--tm-text-secondary);
      line-height: 1.3;
    }

    .tpl-toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--tm-text);
      cursor: pointer;

      input {
        width: 16px;
        height: 16px;
        accent-color: var(--tm-primary);
      }
    }

    .tpl-more-toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 10px;
      padding: 0;
      border: 0;
      background: transparent;
      color: #0f766e;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;

      &:hover { text-decoration: underline; }
    }

    .tpl-form-status {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 10px 0 0;
      color: var(--tm-muted);
      font-size: 11px;

      &.ready { color: #15803d; }
    }

    @media (max-width: 520px) {
      .tpl-form-fields { grid-template-columns: 1fr; }
    }
  `,
})
export class TemplateFormComponent {
  readonly template = input.required<PostTemplateDefinition>();
  readonly values = input.required<Record<string, string>>();
  readonly valueChange = output<{ key: string; value: string }>();

  readonly requiredFields = computed(() =>
    this.template().fields.filter((f) => f.required),
  );
  readonly optionalFields = computed(() =>
    this.template().fields.filter((f) => !f.required),
  );
  readonly showOptional = signal(false);

  readonly isComplete = computed(() =>
    this.template().fields.every((f) => !f.required || !!this.values()[f.key]?.trim()),
  );

  onFieldChange(key: string, value: string): void {
    this.valueChange.emit({ key, value });
  }

  inputType(type: string): string {
    switch (type) {
      case 'number':
      case 'price':
        return 'number';
      case 'date':
        return 'date';
      case 'time':
        return 'time';
      case 'datetime':
        return 'datetime-local';
      case 'url':
        return 'url';
      case 'phone':
        return 'tel';
      default:
        return 'text';
    }
  }

  splitMultiValue(v: string | undefined): string[] {
    return (v || '').split(',').filter((s) => s.length > 0);
  }
}
