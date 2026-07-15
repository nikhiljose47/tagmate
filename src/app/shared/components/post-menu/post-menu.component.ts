import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';

/**
 * Top-right kebab menu for a post card (Instagram/WhatsApp style).
 * Shows "Delete" for the post owner, "Report" otherwise.
 */
@Component({
  selector: 'app-post-menu',
  standalone: true,
  templateUrl: './post-menu.component.html',
  styleUrl: './post-menu.component.scss',
})
export class PostMenuComponent {
  @Input() canDelete = false;
  @Output() deletePost = new EventEmitter<void>();
  @Output() reportPost = new EventEmitter<void>();

  protected readonly open = signal(false);

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  toggle(event: Event): void {
    event.stopPropagation();
    this.open.update((v) => !v);
  }

  onDelete(): void {
    this.open.set(false);
    this.deletePost.emit();
  }

  onReport(): void {
    this.open.set(false);
    this.reportPost.emit();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
