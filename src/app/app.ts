import { afterNextRender, Component, computed, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, map, startWith } from 'rxjs';
import { ToastService } from './core/services/toast.service';
import { NavComponent } from './layout/nav/nav';
import { PreloadService } from './core/services/preload.service';
import { NetworkService } from './core/services/network.service';
import { ThemeService } from './core/services/theme.service';

/** Minimum time the static splash (#tm-splash in index.html) stays visible. */
const SPLASH_SHOW_MS = 1800;
const SPLASH_FADE_MS =  450;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, NavComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('tagmate');
  protected readonly toast = inject(ToastService);
  protected readonly network = inject(NetworkService);
  protected readonly theme = inject(ThemeService);

  private readonly platformId = inject(PLATFORM_ID);
  private readonly preload    = inject(PreloadService);
  private readonly router     = inject(Router);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  protected readonly showNav = computed(() => !this.currentUrl().startsWith('/login'));

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Fire prefetches immediately so data arrives during the splash window.
      this.preload.prefetch();

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
