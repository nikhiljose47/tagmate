import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import { Subject, takeUntil } from 'rxjs';
import { Tag } from '../../../../core/models/tag.model';
import { TAG_REPOSITORY } from '../../../../core/repositories/repository.tokens';
import { LoggerService } from '../../../../core/services/logger.service';
import { SocialInteractionsService } from '../../../../core/services/social-interactions.service';
import { SocialPlatformService } from '../../../../core/services/social-platform.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { TagEmojiPipe } from '../../../../shared/pipes/tag-emoji.pipe';
import { TagGradientPipe } from '../../../../shared/pipes/tag-gradient.pipe';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import { environment } from '../../../../environments/environment';
import {
  FEED_BETA_MAIN_CATEGORIES,
  FeedBetaArea,
  FeedBetaScope,
  WorkspaceStateService,
} from '../../../../layout/workspace/workspace-state.service';

/** One raster tile of the mini map, pre-offset so the post lands at box centre. */
interface MapTile {
  readonly url: string;
  /** CSS `left` / `top`, expressed relative to the box centre. */
  readonly left: string;
  readonly top: string;
}

/**
 * Flattened, render-ready shape for one slide.
 *
 * Everything the template needs is precomputed here (map tiles, labels) so the
 * markup binds plain properties instead of calling methods on every change
 * detection pass.
 */
interface BetaSlide {
  readonly key: string;
  readonly post: Tag;
  readonly username: string;
  readonly location: string;
  /** Compact one-word/short-phrase area name for the author line, e.g. "Sampangirama Nagar". */
  readonly shortLocation: string;
  readonly imageUrls: readonly string[];
  readonly mapTiles: readonly MapTile[];
  readonly isMine: boolean;
}

/** Minimal MapTiler raster style — fewest labels/features of the available set. */
const MAP_STYLE = 'basic-v2';
const MAP_ZOOM = 13;
const TILE_PX = 256;

/**
 * Opening slides whose imagery is always rendered, regardless of what the
 * visibility observer has reported. Guarantees something on the very first
 * paint, and keeps the feed usable if IntersectionObserver never reports.
 */
const EAGER_SLIDES = 3;

@Component({
  selector: 'app-feed-beta',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    AvatarComponent,
    EmptyStateComponent,
    TagEmojiPipe,
    TagGradientPipe,
    TimeAgoPipe,
  ],
  templateUrl: './feed-beta.html',
  styleUrl: './feed-beta.scss',
})
export class FeedBetaPage implements OnInit, AfterViewInit, OnDestroy {
  private static readonly mapLibrePromise = import('maplibre-gl');

  private readonly tagRepo = inject(TAG_REPOSITORY);
  private readonly logger = inject(LoggerService);
  private readonly ngZone = inject(NgZone);
  protected readonly social = inject(SocialInteractionsService);
  private readonly platform = inject(SocialPlatformService);
  private readonly toast = inject(ToastService);
  protected readonly workspace = inject(WorkspaceStateService);

  protected readonly posts = signal<Tag[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isLoadingMore = signal(false);
  protected readonly loadError = signal(false);
  protected readonly hasMore = signal(true);

  private offset = 0;
  private readonly PAGE_SIZE = 25;
  private readonly destroy$ = new Subject<void>();

  @ViewChild('scroller') private scroller?: ElementRef<HTMLElement>;
  @ViewChild('scrollSentinel') private sentinel?: ElementRef<HTMLElement>;
  @ViewChild('drawerMap') private drawerMapElement?: ElementRef<HTMLDivElement>;
  private observer?: IntersectionObserver;
  private drawerMap?: MapLibreMap;
  private drawerMarker?: MapLibreMarker;
  private drawerResizeObserver?: ResizeObserver;

  @ViewChildren('slideEl') private slideEls?: QueryList<ElementRef<HTMLElement>>;
  private slideObserver?: IntersectionObserver;
  private activeSlideObserver?: IntersectionObserver;

  /** rAF gate so the scroll handler runs at most once per frame. */
  private activeRafPending = false;
  private scrollListener?: () => void;

  /** Key of the slide currently centered in the scroller — drives the fixed top row. */
  protected readonly activeKey = signal<string>('');
  protected readonly activeImageIndexes = signal<Record<string, number>>({});
  protected readonly mapSlide = signal<BetaSlide | null>(null);

  /**
   * Keys of the slides close enough to the viewport to be worth loading images
   * for. Explicit windowing rather than `loading="lazy"`: the tiles are absolutely
   * positioned inside a clipped box, which the browser's own lazy heuristics
   * handle unreliably — and this also caps how much of the feed is ever in flight.
   */
  private readonly liveKeys = signal<ReadonlySet<string>>(new Set());

  /** Always-on window at the head of the feed — see EAGER_SLIDES. */
  private readonly eagerKeys = computed(
    () =>
      new Set(
        this.slides()
          .slice(0, EAGER_SLIDES)
          .map((slide) => slide.key),
      ),
  );

  /**
   * Same visibility rules as the classic feed — bulletins, self-hidden posts,
   * and posts from blocked users never reach the viewport.
   */
  private readonly feedCandidates = computed(() =>
    this.posts().filter((post) => {
      if (post.tag === 'bulletin') return false;
      if (this.social.isHidden(post)) return false;
      if (this.platform.isBlocked(post.userId)) return false;
      // Temporarily disabled — expiry filtering was hiding most of the
      // existing test data. `isPostLive()` is still defined below (used by
      // the "time left" label and My Posts) — just not enforced here.
      // if (!this.isPostLive(post)) return false;
      return true;
    }),
  );

  /**
   * True while a post still belongs in the normal active feed: not expired
   * (`created_at + expires_in` hasn't passed) and not manually ended by its
   * owner (status still 'active'). Expired/ended posts stay in the DB for
   * "My Posts" history — this only hides them from the live feed.
   */
  private isPostLive(post: Tag): boolean {
    if (post.currentStatus && post.currentStatus !== 'active') return false;
    const createdMs = new Date(post.createdAt).getTime();
    if (Number.isNaN(createdMs)) return true;
    return createdMs + post.expiresIn * 60_000 > Date.now();
  }

  private readonly syncFeedScope = effect(() => {
    const candidates = this.feedCandidates();
    const areas = this.areasFor(candidates);
    const categories = this.categoriesFor(candidates);
    this.workspace.feedBetaAreas.set(areas);
    this.workspace.feedBetaCategories.set(categories);

    // Never overwrite a user-picked freeform location (may have 0 posts).
    if (this.workspace.feedBetaScope()?.freeform) return;

    if (!areas.length) {
      if (this.workspace.feedBetaScope()) this.workspace.feedBetaScope.set(null);
      return;
    }

    const current = this.workspace.feedBetaScope();
    if (current) {
      const currentArea = areas.find((area) => area.id === current.areaId);
      if (currentArea) {
        const hasPostsIn = (cat: string) =>
          (currentArea.categoryCounts[cat as keyof typeof currentArea.categoryCounts] ?? 0) > 0;
        const category = hasPostsIn(current.category) ? current.category : 'around';
        const next = this.toScope(currentArea, category);
        if (
          next.category !== current.category ||
          next.location !== current.location ||
          next.country !== current.country ||
          next.hood !== current.hood
        ) {
          this.workspace.feedBetaScope.set(next);
        }
        return;
      }
    }

    const randomPost = candidates[Math.floor(Math.random() * candidates.length)];
    const randomArea = areas.find((area) => area.id === this.areaIdFor(randomPost)) ?? areas[0];
    this.workspace.feedBetaScope.set(this.toScope(randomArea, randomArea.categories[0]));
  });

  private readonly scrollScopeToTop = effect(() => {
    const scope = this.workspace.feedBetaScope();
    const key = scope ? `${scope.areaId}:${scope.category}` : '';
    if (!key) return;

    requestAnimationFrame(() => {
      this.scroller?.nativeElement.scrollTo({ top: 0, behavior: 'auto' });
      this.activeKey.set('');
      this.queueActiveSlideUpdate();
    });
  });

  protected readonly slides = computed<BetaSlide[]>(() => {
    const myUid = this.platform.myUid();
    const scope = this.workspace.feedBetaScope();

    return this.feedCandidates()
      .filter((post) => this.matchesScope(post, scope))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((post) => ({
        key: this.social.postKey(post),
        post,
        username: post.username || 'Anonymous',
        location: this.locationLabel(post),
        shortLocation: this.shortLocationLabel(post),
        imageUrls: post.images?.filter(Boolean) ?? [],
        mapTiles: this.mapTilesFor(post),
        isMine: post.userId === myUid,
      }));
  });

  ngOnInit(): void {
    this.loadPosts(true);

    this.tagRepo
      .liveTags()
      .pipe(takeUntil(this.destroy$))
      .subscribe((post) => {
        this.posts.update((posts) => [
          post,
          ...posts.filter((item) => this.social.postKey(item) !== this.social.postKey(post)),
        ]);
      });

    this.tagRepo
      .liveTagUpdates()
      .pipe(takeUntil(this.destroy$))
      .subscribe((post) =>
        this.posts.update((posts) =>
          posts.map((item) =>
            this.social.postKey(item) === this.social.postKey(post) ? post : item,
          ),
        ),
      );

    this.social.postDeleted$.pipe(takeUntil(this.destroy$)).subscribe((deletedKey) => {
      this.posts.update((posts) => posts.filter((p) => this.social.postKey(p) !== deletedKey));
    });
  }

  ngAfterViewInit(): void {
    this.watchCenteredSlide();

    if (typeof IntersectionObserver === 'undefined') return;

    this.watchSlideVisibility();
    this.watchActiveSlideVisibility();

    if (!this.sentinel) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          this.hasMore() &&
          !this.isLoadingMore() &&
          !this.isLoading()
        ) {
          this.offset += this.PAGE_SIZE;
          this.loadPosts();
        }
      },
      // Root is the inner scroller, not the window — that is what actually scrolls.
      { root: this.scroller?.nativeElement ?? null, rootMargin: '600px' },
    );

    this.observer.observe(this.sentinel.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.slideObserver?.disconnect();
    this.activeSlideObserver?.disconnect();
    if (this.scrollListener && this.scroller) {
      this.scroller.nativeElement.removeEventListener('scroll', this.scrollListener);
    }
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyDrawerMap();
    this.workspace.feedBetaAreas.set([]);
    this.workspace.feedBetaCategories.set([]);
  }

  /** True while the slide is near enough to the viewport to load its imagery. */
  protected isLive(key: string): boolean {
    return this.eagerKeys().has(key) || this.liveKeys().has(key);
  }

  // ── Business card helpers ────────────────────────────────────────────────

  private static readonly INTENT_LABELS: Record<string, string> = {
    offer: 'Offer',
    available_now: 'Available Now',
    open_slot: 'Open Slot',
    happening: 'Happening',
    looking_for: 'Looking For',
    sell_give: 'Sell / Give',
  };

  private static readonly CTA_LABELS: Record<string, string> = {
    message: 'Message',
    call: 'Call',
    whatsapp: 'WhatsApp',
    directions: 'Directions',
    visit_shop: 'Visit Shop',
    view_product: 'View Product',
    book: 'Book',
    join: 'Join',
    interested: 'Interested',
  };

  private static readonly CTA_ICONS: Record<string, string> = {
    message: 'bi-chat-dots-fill',
    call: 'bi-telephone-fill',
    whatsapp: 'bi-whatsapp',
    directions: 'bi-signpost-2-fill',
    visit_shop: 'bi-shop-window',
    view_product: 'bi-box-arrow-up-right',
    book: 'bi-calendar2-check-fill',
    join: 'bi-people-fill',
    interested: 'bi-hand-thumbs-up-fill',
  };

  protected intentLabel(intent: string | undefined): string {
    return intent ? (FeedBetaPage.INTENT_LABELS[intent] ?? intent) : '';
  }

  protected ctaLabel(post: Tag): string {
    return FeedBetaPage.CTA_LABELS[post.cta ?? 'message'] ?? 'Message';
  }

  protected ctaIcon(post: Tag): string {
    return FeedBetaPage.CTA_ICONS[post.cta ?? 'message'] ?? 'bi-chat-dots-fill';
  }

  /** External URL for the CTA when one applies — null means "open the post" (safe universal fallback). */
  protected ctaHref(post: Tag): string | null {
    switch (post.cta) {
      case 'call':
        return post.businessPhone ? `tel:${post.businessPhone}` : null;
      case 'whatsapp':
        return post.businessPhone
          ? `https://wa.me/${post.businessPhone.replace(/\D/g, '')}`
          : null;
      case 'directions':
        return Number.isFinite(post.lat) && Number.isFinite(post.lng)
          ? `https://www.google.com/maps/dir/?api=1&destination=${post.lat},${post.lng}`
          : null;
      case 'visit_shop':
        return post.businessWebsite || null;
      case 'view_product':
        return post.productLink || post.businessWebsite || null;
      default:
        return null;
    }
  }

  /** "3h left" / "42m left" / "Expired" — same rule as `isPostLive`, just a label. */
  protected timeRemainingLabel(post: Tag): string {
    const createdMs = new Date(post.createdAt).getTime();
    const remainingMs = createdMs + post.expiresIn * 60_000 - Date.now();
    if (Number.isNaN(createdMs) || remainingMs <= 0) return 'Expired';
    const hours = Math.floor(remainingMs / 3_600_000);
    if (hours >= 1) return `${hours}h left`;
    return `${Math.max(1, Math.floor(remainingMs / 60_000))}m left`;
  }

  protected imageIndex(key: string): number {
    return this.activeImageIndexes()[key] ?? 0;
  }

  protected onImageStripScroll(key: string, event: Event, total: number): void {
    const el = event.currentTarget as HTMLElement;
    if (!el.clientWidth || total < 2) return;
    const next = Math.max(0, Math.min(total - 1, Math.round(el.scrollLeft / el.clientWidth)));
    if (next === this.imageIndex(key)) return;
    this.activeImageIndexes.update((current) => ({ ...current, [key]: next }));
  }

  protected toggleLike(post: Tag): void {
    this.social.toggleLike(post);
  }

  protected toggleSave(post: Tag): void {
    const saved = this.social.toggleSave(post);
    this.toast.show(saved ? 'Post saved.' : 'Post removed from saved.', 'success');
  }

  protected openLocation(slide: BetaSlide): void {
    if (!this.hasCoordinates(slide.post)) return;
    this.mapSlide.set(slide);
    requestAnimationFrame(() => void this.renderDrawerMap(slide));
  }

  protected hasCoordinates(post: Tag): boolean {
    return Number.isFinite(post.lat) && Number.isFinite(post.lng);
  }

  protected coordinatesLabel(post: Tag): string {
    return this.hasCoordinates(post)
      ? `${post.lat.toFixed(5)}, ${post.lng.toFixed(5)}`
      : 'Location coordinates unavailable';
  }

  protected closeLocation(): void {
    this.mapSlide.set(null);
    this.destroyDrawerMap();
  }

  @HostListener('document:keydown.escape')
  protected closeLocationOnEscape(): void {
    if (this.mapSlide()) this.closeLocation();
  }

  protected async sharePost(post: Tag): Promise<void> {
    const text = post.highlight || 'Check out this Tagmate post.';
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/posts/${encodeURIComponent(this.social.postKey(post))}`
        : '';

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Tagmate post', text, url });
        return;
      }

      await navigator.clipboard?.writeText(`${text} ${url}`.trim());
      this.toast.show('Share link copied.', 'success');
    } catch {
      this.toast.show('Share was cancelled.', 'info');
    }
  }

  private async renderDrawerMap(slide: BetaSlide): Promise<void> {
    const container = this.drawerMapElement?.nativeElement;
    const { lat, lng } = slide.post;
    if (!container || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    if (this.drawerMap) {
      this.drawerMap.easeTo({ center: [lng, lat], zoom: 15, duration: 350 });
      this.drawerMarker?.setLngLat([lng, lat]);
      return;
    }

    try {
      const module = await FeedBetaPage.mapLibrePromise;
      const mapLibre = (module.default ?? module) as typeof import('maplibre-gl');
      if (this.mapSlide()?.key !== slide.key || !this.drawerMapElement?.nativeElement) return;

      this.ngZone.runOutsideAngular(() => {
        this.drawerMap = new mapLibre.Map({
          container: this.drawerMapElement!.nativeElement,
          style: `https://api.maptiler.com/maps/streets-v4/style.json?key=${environment.mapTilerApiKey}`,
          center: [lng, lat],
          zoom: 15,
          minZoom: 3,
          maxZoom: 19,
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
        });
        this.drawerMap.addControl(
          new mapLibre.NavigationControl({ showCompass: false }),
          'bottom-right',
        );
        this.drawerMarker = new mapLibre.Marker({ color: '#e11d48' })
          .setLngLat([lng, lat])
          .addTo(this.drawerMap);
        this.drawerResizeObserver = new ResizeObserver(() => this.drawerMap?.resize());
        this.drawerResizeObserver.observe(this.drawerMapElement!.nativeElement);
      });
    } catch (error) {
      this.logger.error('Failed to open beta feed location map', error);
    }
  }

  private destroyDrawerMap(): void {
    this.drawerResizeObserver?.disconnect();
    this.drawerResizeObserver = undefined;
    this.drawerMarker?.remove();
    this.drawerMarker = undefined;
    this.drawerMap?.remove();
    this.drawerMap = undefined;
  }

  /**
   * Observes every rendered slide and keeps `liveKeys` in sync, re-attaching
   * whenever the rendered list changes (new page, realtime insert, deletion).
   */
  private watchSlideVisibility(): void {
    const live = new Set<string>();

    this.slideObserver = new IntersectionObserver(
      (entries) => {
        let changed = false;

        for (const entry of entries) {
          const key = (entry.target as HTMLElement).dataset['key'];
          if (!key) continue;

          if (entry.isIntersecting) {
            if (!live.has(key)) {
              live.add(key);
              changed = true;
            }
          } else if (live.delete(key)) {
            changed = true;
          }
        }

        // Signal write schedules change detection on its own — no NgZone needed.
        if (changed) this.liveKeys.set(new Set(live));
      },
      // One screen of lead-in/lead-out, so the next post is ready before it snaps in.
      { root: this.scroller?.nativeElement ?? null, rootMargin: '100% 0px' },
    );

    const reobserve = () => {
      this.slideObserver?.disconnect();
      for (const el of this.slideEls ?? []) {
        this.slideObserver?.observe(el.nativeElement);
      }
    };

    reobserve();
    this.slideEls?.changes.pipe(takeUntil(this.destroy$)).subscribe(() => {
      reobserve();
      // A newly-inserted live post can push the centered slide down or
      // become the new centered slide — recompute so the top row keeps up.
      this.queueActiveSlideUpdate();
    });
  }

  private watchActiveSlideVisibility(): void {
    const scrollerEl = this.scroller?.nativeElement;
    if (!scrollerEl) return;

    this.activeSlideObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const key = (visible[0]?.target as HTMLElement | undefined)?.dataset['key'];
        if (key && key !== this.activeKey()) this.activeKey.set(key);
      },
      {
        root: scrollerEl,
        threshold: [0.45, 0.55, 0.65, 0.75],
      },
    );

    const reobserve = () => {
      this.activeSlideObserver?.disconnect();
      for (const el of this.slideEls ?? []) {
        this.activeSlideObserver?.observe(el.nativeElement);
      }
      this.queueActiveSlideUpdate();
    };

    reobserve();
    this.slideEls?.changes.pipe(takeUntil(this.destroy$)).subscribe(() => reobserve());
  }

  /**
   * Keeps `activeKey` in sync with whichever slide's mid-point is nearest the
   * scroller's viewport centre. A scroll listener with rAF gating is used
   * rather than IntersectionObserver: with scroll-snap the centred slide can
   * change without any element crossing a threshold (e.g. when a live post is
   * prepended and shifts the list), and reading `offsetTop`/`clientHeight`
   * directly stays correct in those cases.
   */
  private watchCenteredSlide(): void {
    const scrollerEl = this.scroller?.nativeElement;
    if (!scrollerEl) return;

    this.scrollListener = () => {
      this.queueActiveSlideUpdate();
    };

    scrollerEl.addEventListener('scroll', this.scrollListener, { passive: true });
    // Seed the initial state so the top row is right on first paint.
    this.queueActiveSlideUpdate();
  }

  private queueActiveSlideUpdate(): void {
    if (this.activeRafPending) return;
    this.activeRafPending = true;
    requestAnimationFrame(() => {
      this.activeRafPending = false;
      this.updateActiveSlide();
    });
  }

  private updateActiveSlide(): void {
    const scrollerEl = this.scroller?.nativeElement;
    const els = this.slideEls;
    if (!scrollerEl || !els || !els.length) return;

    const scrollerRect = scrollerEl.getBoundingClientRect();
    const centre = scrollerRect.top + scrollerRect.height / 2;
    let bestKey: string | null = null;
    let bestDist = Infinity;

    for (const el of els) {
      const node = el.nativeElement;
      const key = node.dataset['key'];
      if (!key) continue;
      const rect = node.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const dist = Math.abs(mid - centre);
      if (dist < bestDist) {
        bestDist = dist;
        bestKey = key;
      }
    }

    if (bestKey && bestKey !== this.activeKey()) {
      this.activeKey.set(bestKey);
    }
  }

  protected retry(): void {
    this.offset = 0;
    this.hasMore.set(true);
    this.loadPosts(true);
  }

  private loadPosts(reset = false): void {
    if (reset) {
      this.isLoading.set(true);
      this.posts.set([]);
    } else {
      this.isLoadingMore.set(true);
    }
    this.loadError.set(false);

    this.tagRepo.getPaginated(this.PAGE_SIZE, this.offset).subscribe({
      next: (newPosts) => {
        if (reset) {
          this.posts.set(newPosts);
        } else {
          this.posts.update((current) => {
            const seen = new Set(current.map((item) => this.social.postKey(item)));
            return [...current, ...newPosts.filter((item) => !seen.has(this.social.postKey(item)))];
          });
        }
        this.hasMore.set(newPosts.length === this.PAGE_SIZE);
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      },
      error: (err) => {
        this.logger.error('Failed to load beta feed', err);
        this.loadError.set(true);
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      },
    });
  }

  /** Best available place/address text for the fixed top row. */
  private locationLabel(post: Tag): string {
    if (post.hoodId?.trim()) return post.hoodId.trim();
    if (post.state?.trim() && post.country?.trim()) {
      return `${post.state.trim()}, ${post.country.trim()}`;
    }
    if (post.state?.trim()) return post.state.trim();
    if (post.country?.trim()) return post.country.trim();
    if (Number.isFinite(post.lat) && Number.isFinite(post.lng)) return 'Pinned location';
    return 'Location unavailable';
  }

  /**
   * Compact neighbourhood-level text for the author line, e.g. turns
   * "Kasturba Road, Sampangirama Nagar, Bengaluru, Karnataka" into
   * "Sampangirama Nagar" — `hoodId` is sometimes a full comma-joined address
   * (map-pick flow) and sometimes already a clean area name (current-location
   * flow), so this normalizes both to a single short phrase.
   */
  private shortLocationLabel(post: Tag): string {
    const raw = this.locationLabel(post);
    const parts = raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length <= 1) return parts[0] ?? raw;
    // The first segment is usually a street/road; the second is the neighbourhood.
    return parts[1];
  }

  private matchesScope(post: Tag, scope: FeedBetaScope | null): boolean {
    if (!scope) return false;
    if (this.areaIdFor(post) !== scope.areaId) return false;
    return this.mainCategoryFor(post) === scope.category;
  }

  private areasFor(posts: readonly Tag[]): readonly FeedBetaArea[] {
    const grouped = new Map<
      string,
      {
        state: string;
        country: string;
        hoods: Set<string>;
        categories: Set<string>;
        categoryCounts: Record<(typeof FEED_BETA_MAIN_CATEGORIES)[number], number>;
        postCount: number;
      }
    >();

    for (const post of posts) {
      const country = this.countryFor(post);
      if (!country) continue;
      const category = this.mainCategoryFor(post);
      if (!category) continue;

      const id = this.areaIdFor(post);
      const state = this.stateFor(post);
      const hood = post.hoodId?.trim() || this.locationLabel(post);
      const existing =
        grouped.get(id) ??
        ({
          state,
          country,
          hoods: new Set<string>(),
          categories: new Set<string>(),
          categoryCounts: this.emptyMainCategoryCounts(),
          postCount: 0,
        } satisfies {
          state: string;
          country: string;
          hoods: Set<string>;
          categories: Set<string>;
          categoryCounts: Record<(typeof FEED_BETA_MAIN_CATEGORIES)[number], number>;
          postCount: number;
        });

      if (hood) existing.hoods.add(hood);
      existing.categories.add(category);
      existing.categoryCounts[category] += 1;
      existing.postCount += 1;
      grouped.set(id, existing);
    }

    return [...grouped.entries()]
      .map(([id, area]) => ({
        id,
        // Prefer state name (Kerala) as the primary label; fall back to country
        // for legacy posts written before the state column was populated.
        label: area.state || area.country,
        country: area.country,
        hood: `${area.hoods.size || 1} location${area.hoods.size === 1 ? '' : 's'}`,
        categories: [...FEED_BETA_MAIN_CATEGORIES],
        categoryCounts: area.categoryCounts,
        postCount: area.postCount,
      }))
      .filter((area) => area.categories.length > 0)
      .sort((a, b) => b.postCount - a.postCount || a.label.localeCompare(b.label));
  }

  private categoriesFor(posts: readonly Tag[]): readonly string[] {
    const available = new Set(
      posts
        .filter((post) => this.countryFor(post))
        .map((post) => this.mainCategoryFor(post))
        .filter((category): category is (typeof FEED_BETA_MAIN_CATEGORIES)[number] => !!category),
    );
    return FEED_BETA_MAIN_CATEGORIES.filter((category) => available.has(category));
  }

  private toScope(area: FeedBetaArea, category: string): FeedBetaScope {
    return {
      areaId: area.id,
      location: area.label,
      country: area.country,
      hood: area.hood,
      category,
    };
  }

  private areaIdFor(post: Tag | undefined): string {
    const state = this.stateFor(post);
    const country = this.countryFor(post);
    // ID is state+country so "Kerala, India" and (hypothetically) "Kerala, X"
    // don't collide. Fall back to country-only when state is missing.
    if (state && country) return this.scopeKey(`${state}::${country}`);
    if (country) return this.scopeKey(country);
    return '';
  }

  private emptyMainCategoryCounts(): Record<(typeof FEED_BETA_MAIN_CATEGORIES)[number], number> {
    return {
      'hot-now': 0,
      dating: 0,
      game: 0,
      job: 0,
      around: 0,
    };
  }

  /** Admin-1 region persisted on the tag row at post time. No inference here. */
  private stateFor(post: Tag | undefined): string {
    return post?.state?.trim() ?? '';
  }

  private countryFor(post: Tag | undefined): string {
    const explicit = post?.country?.trim();
    if (explicit && explicit.toLowerCase() !== 'world') return explicit;
    // Fallback for legacy posts written before the country column was populated.
    // Four numeric comparisons per post — negligible; runs inside the existing
    // slides() computed, no new reactive graph work.
    if (!post || !Number.isFinite(post.lat) || !Number.isFinite(post.lng)) return '';
    if (post.lat >= 6 && post.lat <= 38 && post.lng >= 68 && post.lng <= 98) return 'India';
    if (post.lat >= 24 && post.lat <= 50 && post.lng >= -125 && post.lng <= -66) {
      return 'United States';
    }
    return '';
  }

  private mainCategoryFor(post: Tag): (typeof FEED_BETA_MAIN_CATEGORIES)[number] | null {
    const tag = post.tag?.trim().toLowerCase();

    if (tag === 'hot-now') return 'hot-now';
    if (tag === 'dating') return 'dating';
    if (tag === 'game' || tag === 'fitness') return 'game';
    if (tag === 'job' || tag === 'biz') return 'job';

    if (
      tag === 'around' ||
      tag === 'shop' ||
      tag === 'help' ||
      tag === 'food' ||
      tag === 'health' ||
      tag === 'learn' ||
      tag === 'space' ||
      tag === 'travel' ||
      tag === 'event' ||
      tag === 'notice' ||
      tag === 'bulletin' ||
      tag === 'alert' ||
      tag === 'poll'
    ) {
      return 'around';
    }

    return null;
  }

  private scopeKey(value: string): string {
    return (
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'nearby'
    );
  }

  /**
   * Builds the mini map from plain raster tiles instead of a live GL map: no
   * WebGL context per slide, free lazy-loading, and nothing to pan or zoom.
   * (MapTiler's static-image endpoint is a paid add-on and 403s on our key.)
   *
   * A 2x2 block is used rather than a single tile because the post can sit
   * anywhere inside its tile — the block is chosen so the post is always at
   * least half a tile from every edge, which leaves no gaps once the mosaic is
   * shifted to put the post at the centre of the box.
   */
  private mapTilesFor(post: Tag): readonly MapTile[] {
    const { lat, lng } = post;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    if (lat <= -85 || lat >= 85) return [];

    const scale = 2 ** MAP_ZOOM;

    // Web-Mercator tile coordinates (fractional).
    const fx = ((lng + 180) / 360) * scale;
    const latRad = (lat * Math.PI) / 180;
    const fy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;

    // The post's position in whole-world pixels at this zoom.
    const pointX = fx * TILE_PX;
    const pointY = fy * TILE_PX;

    const originX = Math.round(fx) - 1;
    const originY = Math.round(fy) - 1;
    const maxIndex = scale - 1;

    const tiles: MapTile[] = [];
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const tileX = originX + dx;
        const tileY = originY + dy;
        if (tileY < 0 || tileY > maxIndex) continue; // no wrap at the poles
        const wrappedX = ((tileX % scale) + scale) % scale; // wrap across the antimeridian

        tiles.push({
          url:
            `https://api.maptiler.com/maps/${MAP_STYLE}/${TILE_PX}/` +
            `${MAP_ZOOM}/${wrappedX}/${tileY}.png?key=${environment.mapTilerApiKey}`,
          left: `calc(50% + ${Math.round(tileX * TILE_PX - pointX)}px)`,
          top: `calc(50% + ${Math.round(tileY * TILE_PX - pointY)}px)`,
        });
      }
    }

    return tiles;
  }
}
