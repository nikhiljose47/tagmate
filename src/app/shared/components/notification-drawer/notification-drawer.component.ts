import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { LocalNotification } from '../../../core/models/tag.model';
import { SocialInteractionsService } from '../../../core/services/social-interactions.service';
import { SocialPlatformService } from '../../../core/services/social-platform.service';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';

@Component({
  selector: 'app-notification-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TimeAgoPipe],
  templateUrl: './notification-drawer.component.html',
  styleUrl: './notification-drawer.component.scss',
})
export class NotificationDrawerComponent {
  private readonly router = inject(Router);
  protected readonly social = inject(SocialInteractionsService);
  private readonly platform = inject(SocialPlatformService);

  protected readonly today = computed(() =>
    this.social
      .notifications()
      .filter((item) => !this.isBlockedActor(item) && this.isToday(item.createdAt)),
  );
  protected readonly earlier = computed(() =>
    this.social
      .notifications()
      .filter((item) => !this.isBlockedActor(item) && !this.isToday(item.createdAt)),
  );

  private previousFocus: HTMLElement | null = null;

  /** The drawer is opened from outside this component (the topbar bell
   *  button sets the signal directly), so the trigger element is captured
   *  here reactively rather than at a single call site. */
  private readonly trackOpenState = effect(() => {
    if (this.social.notificationsOpen()) {
      this.previousFocus = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    }
  });

  constructor() {
    void this.trackOpenState;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.social.notificationsOpen()) this.close();
  }

  protected close(): void {
    this.social.notificationsOpen.set(false);
    const target = this.previousFocus;
    this.previousFocus = null;
    queueMicrotask(() => target?.focus());
  }

  protected async open(item: LocalNotification): Promise<void> {
    await this.social.markNotificationRead(item.id);
    this.close();
    if (item.targetType === 'user' && item.targetId) {
      await this.router.navigate(['/users', item.targetId]);
    } else if (item.targetType === 'thread' && item.targetId) {
      await this.router.navigate(['/messages'], { queryParams: { thread: item.targetId } });
    } else if (item.postId) {
      await this.router.navigate(
        ['/posts', item.postId],
        item.targetType === 'comment' && item.targetId
          ? { fragment: `comment-${item.targetId}` }
          : undefined,
      );
    }
  }

  private isToday(value: string): boolean {
    const date = new Date(value);
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  private isBlockedActor(item: LocalNotification): boolean {
    return !!item.actorId && this.platform.isBlocked(item.actorId);
  }
}
