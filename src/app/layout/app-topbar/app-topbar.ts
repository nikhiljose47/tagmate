import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith, Subscription } from 'rxjs';
import { AppTheme, ThemeService } from '../../core/services/theme.service';
import { UserSessionService } from '../../core/services/user-session.service';
import { TAG_REPOSITORY } from '../../core/repositories/repository.tokens';
import { Tag } from '../../core/models/tag.model';
import { FeedBetaArea, WorkspaceStateService } from '../workspace/workspace-state.service';
import { SocialInteractionsService } from '../../core/services/social-interactions.service';
import { ToastService } from '../../core/services/toast.service';
import { Store } from '@ngrx/store';
import { selectHood } from '../../store/user-preferences/user-preference.selectors';
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';
import { placeCode } from '../../core/data/state-codes';

interface NominatimPlace {
  place_id: number;
  display_name: string;
  address: {
    state?: string;
    country?: string;
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    neighbourhood?: string;
    county?: string;
  };
}

/** A pending (not-yet-applied) choice inside the hood picker modal. */
interface HoodModalSelection {
  kind: 'area' | 'nominatim';
  label: string;
  meta: string;
  payload: FeedBetaArea | NominatimPlace;
}

/** One row in the Google-Maps-style "posts in this hood" search dropdown. */
interface HoodSearchResult {
  id: string;
  title: string;
  tag: string;
  location: string;
  username: string;
}

@Component({
  selector: 'app-topbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, ClickOutsideDirective],
  templateUrl: './app-topbar.html',
  styleUrl: './app-topbar.scss',
})
export class AppTopbarComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly tagRepo = inject(TAG_REPOSITORY, { optional: true });
  protected readonly theme = inject(ThemeService);
  protected readonly session = inject(UserSessionService);
  protected readonly social = inject(SocialInteractionsService);
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

  protected readonly isFeedBeta = computed(() => this.currentUrl().split('?')[0] === '/feed-beta');

  protected readonly nominatimResults = signal<NominatimPlace[]>([]);
  protected readonly isNominatimLoading = signal(false);
  private nominatimAbort?: AbortController;

  /** Nominatim suggestions that don't already match an existing feed area. */
  protected readonly nominatimSuggestions = computed(() => {
    const existingIds = new Set(this.workspace.feedBetaAreas().map((a) => a.id));
    return this.nominatimResults().filter((place) => {
      const id = this.toAreaId(place.address?.state ?? '', place.address?.country ?? '');
      return id && !existingIds.has(id);
    });
  });

  /**
   * Number of unread hot-now posts to badge the 🔥 chip with. Currently the
   * count of hot-now posts in the user's home hood; the badge disappears once
   * the user switches the feed to the hot-now filter.
   */
  protected readonly hotNowBadgeCount = computed(() => {
    const scope = this.workspace.feedBetaScope();
    if (scope?.category === 'hot-now') return 0;

    const h = this.hood();
    const norm = (s: string) => s.trim().toLowerCase();
    const area = this.workspace
      .feedBetaAreas()
      .find((a) => (h?.state ? norm(a.label) === norm(h.state) : false));
    return area?.categoryCounts['hot-now'] ?? 0;
  });

  /**
   * Whether the home hood actually has any hot-now posts, independent of the
   * unread badge (which zeroes out once the hot-now scope is active). Used to
   * decide whether clicking the chip should navigate or just explain there's
   * nothing to see.
   */
  protected readonly hasHotNowActivity = computed(() => {
    const h = this.hood();
    const norm = (s: string) => s.trim().toLowerCase();
    const area = this.workspace
      .feedBetaAreas()
      .find((a) => (h?.state ? norm(a.label) === norm(h.state) : false));
    return (area?.categoryCounts['hot-now'] ?? 0) > 0;
  });

  /** Shows a brief "no hot news around" tip when the chip is clicked with nothing to show. */
  protected readonly hotNowInfoOpen = signal(false);
  private hotNowInfoTimer?: ReturnType<typeof setTimeout>;

  /** Full "hood/place" name — used for accessibility labels, not display. */
  protected readonly hoodChipLabel = computed(() => {
    const scope = this.workspace.feedBetaScope();
    if (scope) return scope.hood?.trim() || scope.location?.trim() || 'Set location';
    const h = this.hood();
    return h?.place?.trim() || h?.district?.trim() || h?.state?.trim() || 'Set location';
  });

  /** Short place code shown in the chip itself, e.g. "KA" for Karnataka. */
  protected readonly hoodChipCode = computed(() => {
    const scope = this.workspace.feedBetaScope();
    const stateName = scope?.location?.trim() || this.hood()?.state?.trim() || '';
    return placeCode(stateName) || placeCode(this.hoodChipLabel());
  });

  /** Apple/Mac-style "change your location" modal — search, pick, Save, close. */
  protected readonly hoodModalOpen = signal(false);
  protected readonly hoodModalQuery = signal('');
  private readonly hoodModalSelection = signal<HoodModalSelection | null>(null);
  protected readonly hoodModalSelectionLabel = computed(
    () => this.hoodModalSelection()?.label ?? null,
  );
  protected readonly hoodModalSelectionMeta = computed(
    () => this.hoodModalSelection()?.meta ?? null,
  );

  /** Feed areas matching the modal's search box; unfiltered list when it's empty. */
  protected readonly hoodModalAreaResults = computed(() => {
    const query = this.hoodModalQuery().trim().toLowerCase();
    const options = this.workspace.feedBetaAreas();
    if (!query) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) || option.country.toLowerCase().includes(query),
    );
  });

  /** Google-Maps-style "type a phrase, see matching posts/tags in this hood" search. */
  protected readonly postSearchQuery = signal('');
  protected readonly postSearchOpen = signal(false);
  protected readonly postSearchResults = signal<HoodSearchResult[]>([]);
  protected readonly isPostSearching = signal(false);
  private postSearchTimeout?: ReturnType<typeof setTimeout>;
  private postSearchRequest = 0;

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

  private readonly routerEvents: Subscription;

  constructor() {
    this.routerEvents = this.router.events.subscribe((event) => {
      if (!(event instanceof NavigationEnd)) return;
      this.closePostSearch();
    });
  }

  ngOnDestroy(): void {
    if (this.hotNowInfoTimer) clearTimeout(this.hotNowInfoTimer);
    if (this.postSearchTimeout) clearTimeout(this.postSearchTimeout);
    this.routerEvents.unsubscribe();
    this.nominatimAbort?.abort();
  }

  // ── Hood picker modal ───────────────────────────────────────────────────

  /** Opens the modal with a blank search box and no pending pick. */
  protected openHoodModal(): void {
    this.hoodModalQuery.set('');
    this.hoodModalSelection.set(null);
    this.hoodModalOpen.set(true);
    this.closePostSearch();
  }

  /** Closes the modal and discards any pending (unsaved) selection. */
  protected closeHoodModal(): void {
    this.hoodModalOpen.set(false);
    this.hoodModalQuery.set('');
    this.hoodModalSelection.set(null);
    this.nominatimAbort?.abort();
    this.nominatimResults.set([]);
    this.isNominatimLoading.set(false);
  }

  /** Typing in the modal search box — filters known areas and queries Nominatim. */
  protected onHoodModalQueryChange(value: string): void {
    this.hoodModalQuery.set(value);

    const query = value.trim();
    if (query.length < 2) {
      this.nominatimResults.set([]);
      this.isNominatimLoading.set(false);
      return;
    }
    this.isNominatimLoading.set(true);
    this.searchNominatim(query);
  }

  /** Enter key in the search box pends the top match, same as clicking it. */
  protected pickFirstHoodModalResult(): void {
    const first = this.hoodModalAreaResults()[0];
    if (first) this.pickHoodArea(first);
  }

  /** Marks a known feed area as the pending (not-yet-saved) pick. */
  protected pickHoodArea(area: FeedBetaArea): void {
    this.hoodModalSelection.set({
      kind: 'area',
      label: area.label,
      meta: area.country,
      payload: area,
    });
  }

  /** Marks a Nominatim global-search result as the pending pick. */
  protected pickHoodNominatim(place: NominatimPlace): void {
    const label = place.address?.state || place.display_name.split(',')[0]?.trim() || '';
    this.hoodModalSelection.set({
      kind: 'nominatim',
      label,
      meta: place.address?.country || '',
      payload: place,
    });
  }

  protected isPendingArea(id: string): boolean {
    const sel = this.hoodModalSelection();
    return sel?.kind === 'area' && (sel.payload as FeedBetaArea).id === id;
  }

  protected isPendingNominatim(placeId: number): boolean {
    const sel = this.hoodModalSelection();
    return sel?.kind === 'nominatim' && (sel.payload as NominatimPlace).place_id === placeId;
  }

  /** Applies the pending pick to the feed scope and closes the modal. */
  protected submitHoodModal(): void {
    const sel = this.hoodModalSelection();
    if (sel?.kind === 'area') this.applyFeedBetaArea((sel.payload as FeedBetaArea).id);
    else if (sel?.kind === 'nominatim')
      this.applyFeedBetaFromNominatim(sel.payload as NominatimPlace);

    this.closeHoodModal();
  }

  // ── Hood-scoped post search (center bar) ────────────────────────────────

  protected onPostSearchChange(value: string): void {
    this.postSearchQuery.set(value);
    this.postSearchOpen.set(true);
    if (this.postSearchTimeout) clearTimeout(this.postSearchTimeout);

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      this.postSearchResults.set([]);
      this.isPostSearching.set(false);
      return;
    }

    this.isPostSearching.set(true);
    this.postSearchTimeout = setTimeout(() => this.runHoodSearch(trimmed), 250);
  }

  protected openPostSearch(): void {
    this.postSearchOpen.set(true);
  }

  protected closePostSearch(): void {
    this.postSearchOpen.set(false);
  }

  protected async goToSearchResult(result: HoodSearchResult): Promise<void> {
    this.closePostSearch();
    this.postSearchQuery.set('');
    this.postSearchResults.set([]);
    await this.router.navigate(['/posts', result.id]);
  }

  private runHoodSearch(query: string): void {
    if (!this.tagRepo) {
      this.postSearchResults.set([]);
      this.isPostSearching.set(false);
      return;
    }

    const request = ++this.postSearchRequest;
    const scopeLabel = this.currentHoodStateLabel();
    this.tagRepo.getPaginated(40, 0, query).subscribe({
      next: (posts) => {
        if (request !== this.postSearchRequest) return;
        const inScope = scopeLabel
          ? posts.filter((post) => (post.state ?? '').trim().toLowerCase() === scopeLabel)
          : posts;
        const list = (inScope.length ? inScope : posts)
          .slice(0, 8)
          .map((post) => this.toHoodSearchResult(post));
        this.postSearchResults.set(list);
        this.isPostSearching.set(false);
      },
      error: () => {
        this.postSearchResults.set([]);
        this.isPostSearching.set(false);
      },
    });
  }

  /** State name of the currently selected hood/scope, for client-side filtering. */
  private currentHoodStateLabel(): string | null {
    if (this.isFeedBeta()) {
      const scope = this.workspace.feedBetaScope();
      return scope?.location?.trim().toLowerCase() || null;
    }
    const h = this.hood();
    return h?.state?.trim().toLowerCase() || null;
  }

  private toHoodSearchResult(post: Tag): HoodSearchResult {
    const id = post.id ?? `${post.userId}-${post.createdAt}`;
    return {
      id,
      title: post.highlight || 'Untitled post',
      tag: post.tag || 'general',
      location: this.shortHoodLabel(post.hoodId?.trim() || post.state || 'Nearby'),
      username: post.username || 'Anonymous',
    };
  }

  /** Collapses a full comma-joined address (or clean name) to one short phrase. */
  private shortHoodLabel(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return 'Nearby';
    const parts = trimmed
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length <= 1) return parts[0] ?? trimmed;
    return parts[1]!;
  }

  /** Commits a known feed area as the active scope. */
  private applyFeedBetaArea(areaId: string): void {
    const area = this.workspace.feedBetaAreas().find((option) => option.id === areaId);
    if (!area) return;
    const currentCategory = this.workspace.feedBetaScope()?.category;
    const hasPostsIn = (cat: string) =>
      (area.categoryCounts[cat as keyof typeof area.categoryCounts] ?? 0) > 0;
    const category = currentCategory && hasPostsIn(currentCategory) ? currentCategory : 'around';
    this.workspace.feedBetaScope.set({
      areaId: area.id,
      location: area.label,
      country: area.country,
      hood: area.hood,
      category,
    });
  }

  /**
   * Home-hood shortcut: jump to the user's home hood on the feed, filtered to
   * `hot-now`. If posts already exist for the user's state+country the existing
   * feed area is used; otherwise a freeform scope is set (empty-state UX).
   */
  protected onHotNowChipClick(): void {
    const alreadyActive = this.workspace.feedBetaScope()?.category === 'hot-now';
    if (!alreadyActive && !this.hasHotNowActivity()) {
      this.showHotNowInfo();
      return;
    }
    this.openHomeHoodFeed();
  }

  private showHotNowInfo(): void {
    clearTimeout(this.hotNowInfoTimer);
    this.hotNowInfoOpen.set(true);
    this.hotNowInfoTimer = setTimeout(() => this.hotNowInfoOpen.set(false), 2500);
  }

  protected openHomeHoodFeed(): void {
    const h = this.hood();
    if (!h?.state) return;

    const norm = (s: string) => s.trim().toLowerCase();
    const existing = this.workspace
      .feedBetaAreas()
      .find(
        (a) =>
          norm(a.label) === norm(h.state) &&
          (h.country ? norm(a.country) === norm(h.country) : true),
      );

    if (existing) {
      this.workspace.feedBetaScope.set({
        areaId: existing.id,
        location: existing.label,
        country: existing.country,
        hood: existing.hood,
        category: 'hot-now',
      });
    } else {
      const slug = (v: string) =>
        v
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      const areaId =
        h.state && h.country ? slug(`${h.state}::${h.country}`) : slug(h.country || h.state);
      this.workspace.feedBetaScope.set({
        areaId,
        location: h.state,
        country: h.country || h.state,
        hood: h.district || h.place || h.state,
        category: 'hot-now',
        freeform: true,
      });
    }

    if (this.currentUrl().split('?')[0] !== '/feed-beta') {
      void this.router.navigateByUrl('/feed-beta');
    }
  }

  /** True when the given state+country matches the signed-in user's home hood. */
  protected isUserHood(state: string | undefined, country: string | undefined): boolean {
    const h = this.hood();
    if (!h?.state || !state) return false;
    const norm = (s: string) => s.trim().toLowerCase();
    return norm(h.state) === norm(state) && (!!country ? norm(h.country) === norm(country) : true);
  }

  @HostListener('document:keydown.escape')
  protected closeHomeMenusOnEscape(): void {
    this.userMenuOpen.set(false);
    this.closePostSearch();
    if (this.hoodModalOpen()) this.closeHoodModal();
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

  /** Commits a Nominatim global-search result as the active feed scope. */
  private applyFeedBetaFromNominatim(place: NominatimPlace): void {
    const state = place.address?.state ?? '';
    const country = place.address?.country ?? '';
    const areaId = this.toAreaId(state, country);
    if (!areaId) return;

    // If an existing area already covers this state+country, use it as-is.
    const existing = this.workspace.feedBetaAreas().find((a) => a.id === areaId);
    if (existing) {
      this.applyFeedBetaArea(existing.id);
      return;
    }

    const label = state || place.display_name.split(',')[0]?.trim() || '';
    this.workspace.feedBetaScope.set({
      areaId,
      location: label,
      country: country || label,
      hood: place.display_name.split(',')[0]?.trim() || '',
      category: 'around',
      freeform: true,
    });
  }

  private searchNominatim(query: string): void {
    this.nominatimAbort?.abort();
    this.nominatimAbort = new AbortController();
    const { signal } = this.nominatimAbort;

    const url =
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6`;

    fetch(url, {
      signal,
      headers: { 'Accept-Language': 'en', 'User-Agent': 'Tagmate/1.0' },
    })
      .then(async (res) => {
        const results = (await res.json()) as NominatimPlace[];
        if (signal.aborted) return;
        // Deduplicate by state+country so we don't show 6 rows for "Mumbai".
        const seen = new Set<string>();
        const deduped = results.filter((place) => {
          const key = `${place.address?.state ?? ''}::${place.address?.country ?? ''}`;
          if (seen.has(key) || !key.replace('::', '')) return false;
          seen.add(key);
          return true;
        });
        this.nominatimResults.set(deduped);
        this.isNominatimLoading.set(false);
      })
      .catch(() => {
        if (!signal.aborted) this.isNominatimLoading.set(false);
      });
  }

  private toAreaId(state: string, country: string): string {
    const slug = (v: string) =>
      v
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    if (state && country) return slug(`${state}::${country}`);
    if (country) return slug(country);
    return '';
  }
}
