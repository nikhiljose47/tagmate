import { afterNextRender, Component, computed, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, map, startWith } from 'rxjs';
import { ToastService } from './core/services/toast.service';
import { NavComponent } from './layout/nav/nav';
import { AppTopbarComponent } from './layout/app-topbar/app-topbar';
import { PreloadService } from './core/services/preload.service';
import { NetworkService } from './core/services/network.service';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';
import { NotificationDrawerComponent } from './shared/components/notification-drawer/notification-drawer.component';
import { TelemetryService } from './core/services/telemetry.service';

/** Minimum time the static splash (#tm-splash in index.html) stays visible. */
const SPLASH_SHOW_MS = 1800;
const SPLASH_FADE_MS = 450;

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    CommonModule,
    NavComponent,
    AppTopbarComponent,
    ConfirmDialogComponent,
    NotificationDrawerComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('tagmate');
  protected readonly toast = inject(ToastService);
  protected readonly network = inject(NetworkService);

  private readonly platformId = inject(PLATFORM_ID);
  private readonly preload = inject(PreloadService);
  private readonly router = inject(Router);
  private readonly telemetry = inject(TelemetryService);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly showNav = computed(() => !this.currentUrl().startsWith('/login'));
  protected readonly showTopbar = computed(
    () => this.showNav() && !this.currentUrl().startsWith('/island'),
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Fire prefetches immediately so data arrives during the splash window.
      this.preload.prefetch();
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe((event) =>
          this.telemetry.track('app.route-viewed', { path: event.urlAfterRedirects }),
        );

      // Dismiss the static splash from index.html after the minimum show time.
      afterNextRender(() => {
        setTimeout(() => {
          const el = document.getElementById('tm-splash');
          if (!el) return;
          el.classList.add('hiding');
          setTimeout(() => el.remove(), SPLASH_FADE_MS);
        }, SPLASH_SHOW_MS);
      });
    }
  }
}
