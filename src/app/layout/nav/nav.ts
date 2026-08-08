import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { SocialPlatformService } from '../../core/services/social-platform.service';
import { FeatureFlagsService, AppFeatureFlags } from '../../core/services/feature-flags.service';
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';

interface NavItem {
  route: string;
  icon: string;
  activeIcon: string;
  label: string;
  mobile?: boolean;
  adminOnly?: boolean;
  featureFlag?: keyof AppFeatureFlags;
}

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ClickOutsideDirective],
  templateUrl: './nav.html',
  styleUrls: ['./nav.scss'],
})
export class NavComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  protected readonly platform = inject(SocialPlatformService);
  protected readonly featureFlags = inject(FeatureFlagsService);

  private readonly session = toSignal(this.auth.session$, { initialValue: null });
  readonly isAdmin = computed(() => this.session()?.user?.app_metadata?.['role'] === 'admin');

  readonly navItems: NavItem[] = [
    {
      route: '/feed-beta',
      icon: 'bi-house',
      activeIcon: 'bi-house-fill',
      label: 'Home',
      mobile: true,
    },
    { route: '/hood', icon: 'bi-map', activeIcon: 'bi-map-fill', label: 'Map', mobile: true },
    // Island is intentionally hidden for now.
    {
      route: '/post',
      icon: 'bi-plus-square',
      activeIcon: 'bi-plus-square-fill',
      label: 'Post',
      mobile: true,
    },
    {
      route: '/messages',
      icon: 'bi-chat-left-dots',
      activeIcon: 'bi-chat-left-dots-fill',
      label: 'Messages',
      mobile: true,
    },
    { route: '/reports', icon: 'bi-flag', activeIcon: 'bi-flag-fill', label: 'Reports' },
    {
      route: '/analytics',
      icon: 'bi-bar-chart',
      activeIcon: 'bi-bar-chart-fill',
      label: 'Analytics',
      featureFlag: 'enableAnalytics',
    },
    {
      route: '/admin',
      icon: 'bi-shield-check',
      activeIcon: 'bi-shield-fill-check',
      label: 'Admin',
      adminOnly: true,
    },
    {
      route: '/profile',
      icon: 'bi-person',
      activeIcon: 'bi-person-fill',
      label: 'Profile',
    },
  ];

  readonly moreMenuOpen = signal(false);

  readonly visibleNavItems = computed(() =>
    this.navItems.filter((item) => {
      if (item.adminOnly && !this.isAdmin()) return false;
      if (item.featureFlag === 'enableHoodIsland' && !this.featureFlags.enableHoodIsland())
        return false;
      if (item.featureFlag === 'enableAnalytics' && !this.featureFlags.enableAnalytics())
        return false;
      return true;
    }),
  );

  readonly moreMenuItems = computed(() => this.visibleNavItems().filter((item) => !item.mobile));

  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
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
