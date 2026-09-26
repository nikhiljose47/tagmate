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
  ViewChild,
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

let nextDropdownId = 0;

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
  protected readonly panelId = `tm-dropdown-panel-${++nextDropdownId}`;
  protected readonly panelStyle = signal<Record<string, string>>({});

  @ViewChild('panel') private panelRef?: ElementRef<HTMLDivElement>;

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  private readonly closeOnViewportChange = (event: Event): void => {
    const panel = this.panelRef?.nativeElement;
    if (event.type === 'scroll' && panel && event.composedPath().includes(panel)) return;
    this.close();
  };

  protected get selectedLabel(): string | null {
    return this.options.find((o) => o.value === this._value())?.label ?? null;
  }

  toggle(): void {
    if (this.disabled) return;
    if (this.open()) {
      this.close();
      return;
    }
    const trigger = this.elementRef.nativeElement.querySelector(
      '.tm-dropdown-trigger',
    ) as HTMLElement | null;
    const rect = trigger?.getBoundingClientRect();
    if (rect) {
      const gap = 4;
      const viewportPadding = 8;
      const maxPanelHeight = 260;
      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - gap - viewportPadding);
      const spaceAbove = Math.max(0, rect.top - gap - viewportPadding);
      // Flip above the trigger when there isn't enough room below for a
      // usable list. The popover top layer escapes transformed/blurred page
      // shells while these coordinates keep every edge inside the viewport.
      const openAbove = spaceBelow < 120 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(40, Math.min(maxPanelHeight, openAbove ? spaceAbove : spaceBelow));
      const style: Record<string, string> = { 'max-height': `${maxHeight}px` };
      if (openAbove) {
        style['bottom'] = `${Math.max(viewportPadding, window.innerHeight - rect.top + gap)}px`;
      } else {
        style['top'] = `${Math.min(
          rect.bottom + gap,
          window.innerHeight - viewportPadding - maxHeight,
        )}px`;
      }
      if (this.compact) {
        style['right'] = `${Math.max(viewportPadding, window.innerWidth - rect.right)}px`;
      } else {
        const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
        const left = Math.min(
          Math.max(viewportPadding, rect.left),
          window.innerWidth - viewportPadding - width,
        );
        style['left'] = `${left}px`;
        style['width'] = `${width}px`;
      }
      this.panelStyle.set(style);
    }
    this.open.set(true);
    const panel = this.panelRef?.nativeElement;
    if (panel && !panel.matches(':popover-open')) panel.showPopover();
    this.onTouched();
    window.addEventListener('scroll', this.closeOnViewportChange, true);
    window.addEventListener('resize', this.closeOnViewportChange);
  }

  select(option: DropdownOption): void {
    if (option.disabled) return;
    this._value.set(option.value);
    this.close();
    this.valueChange.emit(option.value);
    this.onChange(option.value);
  }

  close(): void {
    this.open.set(false);
    const panel = this.panelRef?.nativeElement;
    if (panel?.matches(':popover-open')) panel.hidePopover();
    window.removeEventListener('scroll', this.closeOnViewportChange, true);
    window.removeEventListener('resize', this.closeOnViewportChange);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.closeOnViewportChange, true);
    window.removeEventListener('resize', this.closeOnViewportChange);
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
