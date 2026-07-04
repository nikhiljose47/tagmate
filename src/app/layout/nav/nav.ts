import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { filter, map, startWith } from 'rxjs';
import { selectHood } from '../../store/user-preferences/user-preference.selectors';
interface NavItem {
  route:      string;
  icon:       string;
  activeIcon: string;
  label:      string;
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
  private readonly store = inject(Store);

  readonly navItems: NavItem[] = [
    { route: '/hood',    icon: 'bi-geo-alt',    activeIcon: 'bi-geo-alt-fill',    label: 'Hood'    },
    { route: '/tagmate', icon: 'bi-globe',       activeIcon: 'bi-globe2',          label: 'Globe'   },
    { route: '/post',    icon: 'bi-plus-square', activeIcon: 'bi-plus-square-fill',label: 'Post'    },
    { route: '/profile', icon: 'bi-person',      activeIcon: 'bi-person-fill',     label: 'Profile' },
  ];

  private readonly hood = this.store.selectSignal(selectHood);

  /** Jumps straight to the Hood Champion tab for the user's current neighborhood. */
  readonly championRoute = computed(() => [
    '/neighborhood',
    this.slugify(this.hood().name),
  ]);

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

  private slugify(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'nearby';
  }
}
