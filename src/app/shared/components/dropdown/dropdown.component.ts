import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  Output,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { NgStyle } from '@angular/common';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';

export interface DropdownOption {
  label: string;
  value: string;
  disabled?: boolean;
}

/**
 * Shared select-style dropdown: pill trigger + expanding option panel
 * (Bloomberg onboarding "Select Your Industry" pattern). Usable either with
 * `[(ngModel)]` or with plain `[value]` / `(valueChange)` (for signal-backed state).
 */
@Component({
  selector: 'app-dropdown',
  standalone: true,
  imports: [ClickOutsideDirective, NgStyle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dropdown.component.html',
  styleUrl: './dropdown.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DropdownComponent),
      multi: true,
    },
  ],
})
export class DropdownComponent implements ControlValueAccessor, OnDestroy {
  @Input() options: DropdownOption[] = [];
  @Input() placeholder = 'Select';
  @Input() disabled = false;
  /** Compact inline pill sizing — for tight toolbar/footer contexts instead of a full-width field. */
  @Input() @HostBinding('class.tm-dropdown-host--compact') compact = false;

  @Input() set value(v: string | null | undefined) {
    this._value.set(v ?? null);
  }
  get value(): string | null {
    return this._value();
  }
  @Output() readonly valueChange = new EventEmitter<string>();

  protected readonly _value = signal<string | null>(null);
  protected readonly open = signal(false);
  /** Set to fixed viewport coordinates on open, so the panel escapes any
   *  ancestor `overflow: hidden` (e.g. the post composer card) instead of
   *  being clipped like an absolutely-positioned one would be. */
  protected readonly panelStyle = signal<Record<string, string>>({});

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  private readonly reposition = (): void => this.close();

  protected get selectedLabel(): string | null {
    return this.options.find((o) => o.value === this._value())?.label ?? null;
  }

  toggle(): void {
    if (this.disabled) return;
    if (this.open()) {
      this.close();
      return;
    }
    const trigger = this.elementRef.nativeElement.querySelector('.tm-dropdown-trigger');
    const rect = trigger?.getBoundingClientRect();
    if (rect) {
      const gap = 4;
      const maxPanelHeight = 260;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      // Flip above the trigger when there isn't enough room below for a
      // usable list, so the panel never renders partly off-screen (fixed
      // positioning means the page can't be scrolled to reach it).
      const openAbove = spaceBelow < 120 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(
        120,
        Math.min(maxPanelHeight, openAbove ? spaceAbove : spaceBelow),
      );
      const style: Record<string, string> = { 'max-height': `${maxHeight}px` };
      if (openAbove) {
        style['bottom'] = `${window.innerHeight - rect.top + gap}px`;
      } else {
        style['top'] = `${rect.bottom + gap}px`;
      }
      if (this.compact) {
        style['right'] = `${window.innerWidth - rect.right}px`;
      } else {
        style['left'] = `${rect.left}px`;
        style['width'] = `${rect.width}px`;
      }
      this.panelStyle.set(style);
    }
    this.open.set(true);
    this.onTouched();
    window.addEventListener('scroll', this.reposition, true);
    window.addEventListener('resize', this.reposition);
  }

  select(option: DropdownOption): void {
    if (option.disabled) return;
    this._value.set(option.value);
    this.open.set(false);
    this.valueChange.emit(option.value);
    this.onChange(option.value);
  }

  close(): void {
    if (!this.open()) return;
    this.open.set(false);
    window.removeEventListener('scroll', this.reposition, true);
    window.removeEventListener('resize', this.reposition);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.reposition, true);
    window.removeEventListener('resize', this.reposition);
  }

  writeValue(value: string | null): void {
    this._value.set(value ?? null);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
