import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { SocialPlatformService } from '../../core/services/social-platform.service';
interface NavItem {
  route:      string;
  icon:       string;
  activeIcon: string;
  label:      string;
  mobile?:    boolean;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav.html',
  styleUrls: ['./nav.scss'],
})
export class NavComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  protected readonly platform = inject(SocialPlatformService);

  private readonly session = toSignal(this.auth.session$, { initialValue: null });
  readonly isAdmin = computed(() => this.session()?.user?.app_metadata?.['role'] === 'admin');

  readonly navItems: NavItem[] = [
    { route: '/feed',      icon: 'bi-list-ul',        activeIcon: 'bi-list-check',      label: 'Feed', mobile: true },
    { route: '/hood',      icon: 'bi-map',            activeIcon: 'bi-map-fill',        label: 'Map', mobile: true },
    { route: '/island',    icon: 'bi-geo-alt',        activeIcon: 'bi-geo-alt-fill',    label: 'Hood', mobile: true },
    { route: '/post',      icon: 'bi-plus-square',    activeIcon: 'bi-plus-square-fill', label: 'Post', mobile: true },
    { route: '/messages',  icon: 'bi-chat-left-dots', activeIcon: 'bi-chat-left-dots-fill', label: 'Messages', mobile: true },
    { route: '/reports',   icon: 'bi-flag',           activeIcon: 'bi-flag-fill',       label: 'Reports'   },
    { route: '/analytics', icon: 'bi-bar-chart',      activeIcon: 'bi-bar-chart-fill',  label: 'Analytics' },
    { route: '/admin',     icon: 'bi-shield-check',   activeIcon: 'bi-shield-fill-check', label: 'Admin', adminOnly: true },
    { route: '/profile',   icon: 'bi-person',         activeIcon: 'bi-person-fill',     label: 'Profile', mobile: true },
  ];

  readonly moreMenuOpen = signal(false);

  readonly visibleNavItems = computed(() =>
    this.navItems.filter((item) => !item.adminOnly || this.isAdmin())
  );

  readonly moreMenuItems = computed(() =>
    this.visibleNavItems().filter((item) => !item.mobile)
  );

  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  isActive(route: string): boolean {
    return this.currentUrl().startsWith(route);
  }

  toggleMore(): void {
    this.moreMenuOpen.update((v) => !v);
  }

  closeMore(): void {
    this.moreMenuOpen.set(false);
  }

  goTo(route: string): void {
    this.closeMore();
    void this.router.navigateByUrl(route);
  }
}
