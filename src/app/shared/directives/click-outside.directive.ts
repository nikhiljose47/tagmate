import {
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
} from '@angular/core';

@Directive({
  selector: '[tmClickOutside]',
  standalone: true,
})
export class ClickOutsideDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input() tmClickOutsideEnabled = true;
  @Output() readonly tmClickOutside = new EventEmitter<PointerEvent>();

  @HostListener('document:pointerdown', ['$event'])
  protected onDocumentPointerDown(event: PointerEvent): void {
    if (!this.tmClickOutsideEnabled) return;

    const path = event.composedPath?.();
    const clickedInside = path
      ? path.includes(this.host.nativeElement)
      : this.host.nativeElement.contains(event.target as Node | null);

    if (!clickedInside) this.tmClickOutside.emit(event);
  }
}
