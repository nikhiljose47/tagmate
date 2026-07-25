import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { Tag } from '../../../../core/models/tag.model';
import { TAG_REPOSITORY } from '../../../../core/repositories/repository.tokens';
import { LoggerService } from '../../../../core/services/logger.service';
import { SocialInteractionsService } from '../../../../core/services/social-interactions.service';
import { SocialPlatformService } from '../../../../core/services/social-platform.service';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { TagEmojiPipe } from '../../../../shared/pipes/tag-emoji.pipe';
import { TagGradientPipe } from '../../../../shared/pipes/tag-gradient.pipe';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import { environment } from '../../../../environments/environment';

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
  readonly imageUrl: string;
  readonly mapTiles: readonly MapTile[];
  readonly isMine: boolean;
}

/** Minimal MapTiler raster style — fewest labels/features of the available set. */
const MAP_STYLE = 'basic-v2';
const MAP_ZOOM = 14;
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
  imports: [RouterLink, AvatarComponent, EmptyStateComponent, TagEmojiPipe, TagGradientPipe, TimeAgoPipe],
  templateUrl: './feed-beta.html',
  styleUrl: './feed-beta.scss',
})
export class FeedBetaPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly tagRepo = inject(TAG_REPOSITORY);
  private readonly logger = inject(LoggerService);
  private readonly social = inject(SocialInteractionsService);
  private readonly platform = inject(SocialPlatformService);

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
  private observer?: IntersectionObserver;

  @ViewChildren('slideEl') private slideEls?: QueryList<ElementRef<HTMLElement>>;
  private slideObserver?: IntersectionObserver;

  /** rAF gate so the scroll handler runs at most once per frame. */
  private activeRafPending = false;
  private scrollListener?: () => void;

  /** Key of the slide currently centered in the scroller — drives the fixed top row. */
  protected readonly activeKey = signal<string>('');

  /** The centered slide, or the first one until the observer reports. */
  protected readonly activeSlide = computed<BetaSlide | undefined>(() => {
    const list = this.slides();
    if (!list.length) return undefined;
    const key = this.activeKey();
    return list.find((slide) => slide.key === key) ?? list[0];
  });

  /**
   * Keys of the slides close enough to the viewport to be worth loading images
   * for. Explicit windowing rather than `loading="lazy"`: the tiles are absolutely
   * positioned inside a clipped box, which the browser's own lazy heuristics
   * handle unreliably — and this also caps how much of the feed is ever in flight.
   */
  private readonly liveKeys = signal<ReadonlySet<string>>(new Set());

  /** Always-on window at the head of the feed — see EAGER_SLIDES. */
  private readonly eagerKeys = computed(
    () => new Set(this.slides().slice(0, EAGER_SLIDES).map((slide) => slide.key)),
  );

  /**
   * Same visibility rules as the classic feed — bulletins, self-hidden posts,
   * and posts from blocked users never reach the viewport.
   */
  protected readonly slides = computed<BetaSlide[]>(() => {
    const myUid = this.platform.myUid();

    return this.posts()
      .filter((post) => {
        if (post.tag === 'bulletin') return false;
        if (this.social.isHidden(post)) return false;
        if (this.platform.isBlocked(post.userId)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((post) => ({
        key: this.social.postKey(post),
        post,
        username: post.username || 'Anonymous',
        location: this.locationLabel(post),
        imageUrl: post.images?.[0] ?? '',
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
    if (typeof IntersectionObserver === 'undefined') return;

    this.watchSlideVisibility();
    this.watchCenteredSlide();

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
    if (this.scrollListener && this.scroller) {
      this.scroller.nativeElement.removeEventListener('scroll', this.scrollListener);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** True while the slide is near enough to the viewport to load its imagery. */
  protected isLive(key: string): boolean {
    return this.eagerKeys().has(key) || this.liveKeys().has(key);
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
      this.updateActiveSlide();
    });
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
      if (this.activeRafPending) return;
      this.activeRafPending = true;
      requestAnimationFrame(() => {
        this.activeRafPending = false;
        this.updateActiveSlide();
      });
    };

    scrollerEl.addEventListener('scroll', this.scrollListener, { passive: true });
    // Seed the initial state so the top row is right on first paint.
    this.updateActiveSlide();
  }

  private updateActiveSlide(): void {
    const scrollerEl = this.scroller?.nativeElement;
    const els = this.slideEls;
    if (!scrollerEl || !els || !els.length) return;

    const centre = scrollerEl.scrollTop + scrollerEl.clientHeight / 2;
    let bestKey: string | null = null;
    let bestDist = Infinity;

    for (const el of els) {
      const node = el.nativeElement;
      const key = node.dataset['key'];
      if (!key) continue;
      const mid = node.offsetTop + node.clientHeight / 2;
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

  /** Hood name when we have one, otherwise fall back to trimmed coordinates. */
  private locationLabel(post: Tag): string {
    if (post.hoodId?.trim()) return post.hoodId.trim();
    if (Number.isFinite(post.lat) && Number.isFinite(post.lng)) {
      return `${post.lat.toFixed(4)}, ${post.lng.toFixed(4)}`;
    }
    return 'Location unavailable';
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
    const fy =
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;

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
