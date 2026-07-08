import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
interface NavItem {
  route:      string;
  icon:       string;
  activeIcon: string;
  label:      string;
  mobile?:    boolean;
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

  readonly navItems: NavItem[] = [
    { route: '/feed',      icon: 'bi-list-ul',        activeIcon: 'bi-list-check',      label: 'Feed', mobile: true },
    { route: '/hood',      icon: 'bi-map',            activeIcon: 'bi-map-fill',        label: 'Map', mobile: true },
    { route: '/post',      icon: 'bi-plus-square',    activeIcon: 'bi-plus-square-fill', label: 'Post', mobile: true },
    { route: '/tagmate',   icon: 'bi-buildings',      activeIcon: 'bi-buildings-fill',  label: 'Hoods'     },
    { route: '/messages',  icon: 'bi-chat-left-dots', activeIcon: 'bi-chat-left-dots-fill', label: 'Messages', mobile: true },
    { route: '/reports',   icon: 'bi-flag',           activeIcon: 'bi-flag-fill',       label: 'Reports'   },
    { route: '/analytics', icon: 'bi-bar-chart',      activeIcon: 'bi-bar-chart-fill',  label: 'Analytics' },
    { route: '/admin',     icon: 'bi-shield-check',   activeIcon: 'bi-shield-fill-check', label: 'Admin'   },
    { route: '/profile',   icon: 'bi-person',         activeIcon: 'bi-person-fill',     label: 'Profile', mobile: true },
  ];

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
}
