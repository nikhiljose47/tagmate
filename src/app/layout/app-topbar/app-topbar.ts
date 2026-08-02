import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith, Subscription } from 'rxjs';
import { AppTheme, ThemeService } from '../../core/services/theme.service';
import { UserSessionService } from '../../core/services/user-session.service';
import { TAG_REPOSITORY } from '../../core/repositories/repository.tokens';
import { Tag } from '../../core/models/tag.model';
import {
  CommandResult,
  FEED_BETA_MAIN_CATEGORIES,
  HomeDistrictOption,
  WorkspaceStateService,
} from '../workspace/workspace-state.service';
import { SocialInteractionsService } from '../../core/services/social-interactions.service';
import { SocialPlatformService } from '../../core/services/social-platform.service';
import { SocialProfile } from '../../core/models/social.model';
import { ToastService } from '../../core/services/toast.service';
import { Store } from '@ngrx/store';
import { selectHood } from '../../store/user-preferences/user-preference.selectors';
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ClickOutsideDirective],
  templateUrl: './app-topbar.html',
  styleUrl: './app-topbar.scss',
})
export class AppTopbarComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly tagRepo = inject(TAG_REPOSITORY, { optional: true });
  protected readonly theme = inject(ThemeService);
  protected readonly session = inject(UserSessionService);
  protected readonly social = inject(SocialInteractionsService);
  private readonly platform = inject(SocialPlatformService);
  private readonly toast = inject(ToastService);
  private readonly store = inject(Store);
  protected readonly workspace = inject(WorkspaceStateService);
  protected readonly hood = this.store.selectSignal(selectHood);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly isHome = computed(() => {
    const path = this.currentUrl().split('?')[0];
    return path === '/feed' || path === '/feed-beta';
  });
  protected readonly isFeedBeta = computed(() => this.currentUrl().split('?')[0] === '/feed-beta');
  protected readonly homeDistrictQuery = signal('');
  protected readonly homeDistrictSearchOpen = signal(false);
  protected readonly homeTagMenuOpen = signal(false);
  private readonly homeDistrictMatches = signal<HomeDistrictOption[]>([]);
  protected readonly homeDistrictResults = computed(() => {
    const query = this.homeDistrictQuery().trim().toLowerCase();
    const options = query ? this.homeDistrictMatches() : this.workspace.homeDistrictOptions();
    if (!query) return options;
    return options.filter(
      (option) =>
        option.name.toLowerCase().includes(query) || option.country.toLowerCase().includes(query),
    );
  });
  protected readonly homeDistrictLabel = computed(
    () => this.workspace.homeDistrict()?.name || 'Choose district',
  );
  protected readonly homeDistrictCountry = computed(
    () => this.workspace.homeDistrict()?.country || 'Search districts only',
  );
  protected readonly homeTagLabel = computed(() => {
    if (this.isFeedBeta()) {
      const tag = this.workspace.feedBetaScope()?.category ?? FEED_BETA_MAIN_CATEGORIES[0];
      return this.titleTag(tag);
    }
    const tag = this.workspace.homeTag();
    return tag === 'all' ? 'All tags' : `#${tag}`;
  });
  protected readonly feedBetaCountryResults = computed(() => {
    const query = this.homeDistrictQuery().trim().toLowerCase();
    const options = this.workspace.feedBetaAreas();
    if (!query) return options;
    // Match either state name (label) or country so users can drill in from
    // either angle: "kerala" narrows to that state, "india" lists every
    // state in India.
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) || option.country.toLowerCase().includes(query),
    );
  });
  protected readonly feedBetaCountryLabel = computed(() => {
    const scope = this.workspace.feedBetaScope();
    if (scope) return scope.location || scope.country || 'Choose region';
    const first = this.workspace.feedBetaAreas()[0];
    return first?.label ?? 'Choose region';
  });
  protected readonly feedBetaCountryMeta = computed(() => {
    const current = this.workspace.feedBetaScope();
    const area = current
      ? this.workspace.feedBetaAreas().find((option) => option.id === current.areaId)
      : this.workspace.feedBetaAreas()[0];
    if (!area) return 'Regions only';
    // Show country as the meta line when the label already carries the state.
    return area.label !== area.country ? area.country : area.hood;
  });
  protected readonly feedBetaTagOptions = computed(() => {
    return [...FEED_BETA_MAIN_CATEGORIES];
  });

  protected readonly query = signal('');
  protected readonly results = signal<CommandResult[]>([]);
  protected readonly isSearching = signal(false);
  protected readonly userMenuOpen = signal(false);
  protected readonly allThemes: { key: AppTheme; label: string; icon: string }[] = [
    { key: 'light', label: 'Light', icon: 'bi-sun-fill' },
    { key: 'dark', label: 'Dark', icon: 'bi-moon-fill' },
    { key: 'midnight', label: 'Midnight', icon: 'bi-moon-stars-fill' },
    { key: 'forest', label: 'Forest', icon: 'bi-tree-fill' },
    { key: 'sepia', label: 'Sepia', icon: 'bi-cup-hot-fill' },
  ];

  protected readonly visibleThemes = computed(() => {
    const valid = this.theme.availableThemes();
    return this.allThemes.filter((t) => valid.includes(t.key));
  });

  protected get themes() {
    return this.visibleThemes();
  }

  private searchTimeout?: ReturnType<typeof setTimeout>;
  private readonly routerEvents: Subscription;
  private homeSearchRequest = 0;

  constructor() {
    this.routerEvents = this.router.events.subscribe((event) => {
      if (!(event instanceof NavigationEnd)) return;
      if (this.isHome()) this.closeCommand();
    });
  }

  ngOnInit(): void {
    this.loadHomeOptions();
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.routerEvents.unsubscribe();
  }

  protected onQueryChange(value: string): void {
    this.query.set(value);
    if (this.searchTimeout) clearTimeout(this.searchTimeout);

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      this.results.set(this.quickActions());
      this.isSearching.set(false);
      return;
    }

    this.isSearching.set(true);
    this.searchTimeout = setTimeout(() => this.searchPosts(trimmed), 250);
  }

  protected openCommand(): void {
    this.workspace.commandOpen.set(true);
    if (!this.query().trim()) this.results.set(this.quickActions());
  }

  protected closeCommand(): void {
    this.workspace.commandOpen.set(false);
  }

  protected openHomeDistrictSearch(): void {
    this.homeDistrictQuery.set('');
    this.homeDistrictSearchOpen.set(true);
    this.homeTagMenuOpen.set(false);
  }

  protected closeHomeDistrictSearch(): void {
    this.homeDistrictQuery.set('');
    this.homeDistrictSearchOpen.set(false);
  }

  protected closeHomeScopeMenus(): void {
    this.closeHomeDistrictSearch();
    this.homeTagMenuOpen.set(false);
  }

  protected searchDistricts(value: string): void {
    this.homeDistrictQuery.set(value);
    this.homeDistrictSearchOpen.set(true);

    if (this.isFeedBeta()) return;

    const query = value.trim();
    if (query.length < 2) {
      this.homeDistrictMatches.set([]);
      return;
    }

    const request = ++this.homeSearchRequest;
    this.tagRepo?.getPaginated(100, 0, query).subscribe({
      next: (posts) => {
        if (request !== this.homeSearchRequest) return;
        this.homeDistrictMatches.set(this.toHomeDistrictOptions(posts, query));
      },
      error: () => this.homeDistrictMatches.set([]),
    });
  }

  protected selectHomeDistrict(option: HomeDistrictOption): void {
    this.workspace.setHomeDistrict(option);
    this.closeHomeDistrictSearch();
  }

  protected selectFirstHomeDistrict(): void {
    if (this.isFeedBeta()) {
      const first = this.feedBetaCountryResults()[0];
      if (first) this.selectFeedBetaCountry(first.id);
      return;
    }
    const first = this.homeDistrictResults()[0];
    if (first) this.selectHomeDistrict(first);
  }

  protected toggleHomeTagMenu(): void {
    this.homeTagMenuOpen.update((open) => !open);
    this.homeDistrictSearchOpen.set(false);
  }

  protected selectHomeTag(tag: string): void {
    if (this.isFeedBeta()) {
      const current = this.workspace.feedBetaScope();
      const area = current
        ? this.workspace.feedBetaAreas().find((option) => option.id === current.areaId)
        : this.workspace.feedBetaAreas()[0];
      if (area) {
        this.workspace.feedBetaScope.set({
          areaId: area.id,
          location: area.label,
          country: area.country,
          hood: area.hood,
          category: tag || FEED_BETA_MAIN_CATEGORIES[0],
        });
      }
      this.homeTagMenuOpen.set(false);
      return;
    }
    this.workspace.setHomeTag(tag);
    this.homeTagMenuOpen.set(false);
  }

  protected selectFeedBetaCountry(areaId: string): void {
    const area = this.workspace.feedBetaAreas().find((option) => option.id === areaId);
    if (!area) return;
    const currentCategory = this.workspace.feedBetaScope()?.category;
    const category =
      currentCategory && area.categories.includes(currentCategory)
        ? currentCategory
        : (area.categories[0] ?? FEED_BETA_MAIN_CATEGORIES[0]);
    this.workspace.feedBetaScope.set({
      areaId: area.id,
      location: area.label,
      country: area.country,
      hood: area.hood,
      category,
    });
    this.closeHomeDistrictSearch();
  }

  @HostListener('document:keydown.escape')
  protected closeHomeMenusOnEscape(): void {
    this.closeHomeDistrictSearch();
    this.homeTagMenuOpen.set(false);
    this.userMenuOpen.set(false);
    this.closeCommand();
  }

  protected async goTo(result: CommandResult): Promise<void> {
    this.closeCommand();
    this.query.set('');
    this.results.set([]);
    if (result.id.startsWith('topic-'))
      await this.router.navigate(['/feed'], { queryParams: { topic: result.title.slice(1) } });
    else await this.router.navigate(result.route);
  }

  protected setTheme(theme: AppTheme): void {
    this.theme.setTheme(theme);
    this.userMenuOpen.set(false);
    this.toast.show('Theme updated.', 'success');
  }

  protected async logout(): Promise<void> {
    await this.session.logout();
    this.userMenuOpen.set(false);
    this.toast.show('Logged out.', 'success');
    await this.router.navigate(['/login']);
  }

  private searchPosts(query: string): void {
    if (!this.tagRepo) {
      this.results.set(this.quickActions());
      this.isSearching.set(false);
      return;
    }

    this.tagRepo.getPaginated(6, 0, query).subscribe({
      next: (posts) => {
        void this.platform.searchProfiles(query, 5).then((profiles) => {
          const hoods = Array.from(
            new Set(posts.map((post) => post.hoodId).filter((hood): hood is string => !!hood)),
          ).slice(0, 3);
          const topics = Array.from(new Set(posts.map((post) => post.tag).filter(Boolean))).slice(
            0,
            3,
          );
          this.results.set([
            ...this.quickActions(query),
            ...profiles.map((profile) => this.toProfileResult(profile)),
            ...hoods.map((hood) => ({
              id: `hood-${hood}`,
              title: hood,
              subtitle: 'Neighborhood',
              route: ['/neighborhood', this.slug(hood)],
              icon: 'bi-geo-alt',
            })),
            ...topics.map((tag) => ({
              id: `topic-${tag}`,
              title: `#${tag}`,
              subtitle: 'Topic',
              route: ['/feed'],
              icon: 'bi-hash',
            })),
            ...posts.map((post) => this.toCommandResult(post)),
          ]);
          this.isSearching.set(false);
        });
      },
      error: () => {
        this.results.set(this.quickActions(query));
        this.isSearching.set(false);
      },
    });
  }

  private loadHomeOptions(): void {
    this.tagRepo?.getPaginated(100, 0).subscribe({
      next: (posts) => {
        this.workspace.setHomeDistrictOptions(this.toHomeDistrictOptions(posts));
        this.workspace.setHomeTagOptions(
          posts.map((post) => post.tag).filter((tag) => tag && tag !== 'bulletin'),
        );
      },
    });
  }

  private toHomeDistrictOptions(posts: Tag[], query = ''): HomeDistrictOption[] {
    const currentHood = this.hood();
    const options = new Map<string, HomeDistrictOption>();
    const normalizedQuery = query.trim().toLowerCase();

    if (
      currentHood?.name &&
      (!normalizedQuery || currentHood.name.toLowerCase().includes(normalizedQuery))
    ) {
      const key = this.slug(currentHood.name);
      options.set(key, {
        key,
        name: currentHood.name,
        country: currentHood.country || 'India',
      });
    }

    for (const post of posts) {
      const name = post.hoodId?.trim();
      if (!name || (normalizedQuery && !name.toLowerCase().includes(normalizedQuery))) continue;
      const key = this.slug(name);
      if (!options.has(key)) {
        options.set(key, {
          key,
          name,
          country: post.country?.trim() || currentHood?.country || 'India',
        });
      }
    }

    return Array.from(options.values());
  }

  private quickActions(query = ''): CommandResult[] {
    const suffix = query ? ` for "${query}"` : '';
    return [
      {
        id: 'qa-feed',
        title: `Search Feed${suffix}`,
        subtitle: 'Scan nearby posts and neighborhood updates',
        route: ['/feed'],
        icon: 'bi-list-ul',
      },
      {
        id: 'qa-map',
        title: 'Open Map Workspace',
        subtitle: 'View tags, heatmaps, filters, and local context',
        route: ['/hood'],
        icon: 'bi-map',
      },
      {
        id: 'qa-report',
        title: 'Review Reports',
        subtitle: 'Open moderation queue and hidden content',
        route: ['/reports'],
        icon: 'bi-flag',
      },
    ];
  }

  private toCommandResult(post: Tag): CommandResult {
    const id = post.id ?? `${post.userId}-${post.createdAt}`;
    return {
      id,
      title: post.highlight || 'Untitled post',
      subtitle: `${post.hoodId || 'Nearby'} - #${post.tag || 'tag'} - ${post.username || 'Anonymous'}`,
      route: ['/posts', id],
      icon: post.tag === 'alert' ? 'bi-exclamation-triangle' : 'bi-geo-alt',
    };
  }

  private toProfileResult(profile: SocialProfile): CommandResult {
    return {
      id: `user-${profile.uid}`,
      title: profile.name,
      subtitle: `${profile.reputation} reputation · Neighbor profile`,
      route: ['/users', profile.uid],
      icon: 'bi-person',
    };
  }

  private slug(value: string): string {
    return (
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'nearby'
    );
  }

  private titleTag(tag: string): string {
    return tag.charAt(0).toUpperCase() + tag.slice(1);
  }
}
