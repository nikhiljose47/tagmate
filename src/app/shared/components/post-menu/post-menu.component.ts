import {
  Component,
  ChangeDetectionStrategy,
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './post-menu.component.html',
  styleUrl: './post-menu.component.scss',
})
export class PostMenuComponent {
  @Input() canDelete = false;
  @Output() deletePost = new EventEmitter<void>();
  @Output() reportPost = new EventEmitter<void>();

  protected readonly open = signal(false);

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  // `toggle()` stops propagation so clicking one post's kebab never bubbles
  // to `document` — which means the outside-click listener below never sees
  // it, so a second post's menu opening couldn't close a still-open first
  // one. Tracking the single open instance here closes it explicitly instead
  // of relying on that bubbling.
  private static current: PostMenuComponent | null = null;

  toggle(event: Event): void {
    event.stopPropagation();
    if (this.open()) {
      this.close();
      return;
    }
    PostMenuComponent.current?.close();
    PostMenuComponent.current = this;
    this.open.set(true);
  }

  onDelete(): void {
    this.close();
    this.deletePost.emit();
  }

  onReport(): void {
    this.close();
    this.reportPost.emit();
  }

  private close(): void {
    this.open.set(false);
    if (PostMenuComponent.current === this) PostMenuComponent.current = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.close();
  }
}
