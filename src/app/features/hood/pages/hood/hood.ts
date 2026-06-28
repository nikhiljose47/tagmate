import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { catchError, debounceTime, map, of, Subject, switchMap, take, takeUntil } from 'rxjs';
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson';
import type {
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  MapMouseEvent,
  Marker,
} from 'maplibre-gl';

import { environment } from '../../../../environments/environment.prod';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { rowToTag } from '../../../../core/services/tag.mapper';
import { Hood } from '../../../../core/models/hood.model';
import { Tag } from '../../../../core/models/tag.model';
import { SharedStateService } from '../../../../core/services/shared-state.service';
import { ToastService } from '../../../../core/services/toast.service';
import { PlaceBoundary, Utils } from '../../../../core/services/utils.service';
import { setUserPreference } from '../../../../store/user-preferences/user-preference.actions';
import { selectHood } from '../../../../store/user-preferences/user-preference.selectors';
import { PreloadService } from '../../../../core/services/preload.service';

// MapLibre source/layer IDs kept as module-level constants for clarity.
const POSTS_SOURCE          = 'posts-source';
const CLUSTERS_LAYER        = 'post-clusters';
const CLUSTER_COUNT_LAYER   = 'post-cluster-count';
const INDIVIDUAL_POSTS_LAYER = 'individual-posts';
const HOOD_SOURCE           = 'hood-source';
const HOOD_FILL_LAYER       = 'hood-fill';
const HOOD_LINE_LAYER       = 'hood-line';
const DEFAULT_ZOOM          = 15;
const ZOOM_LEVELS           = [7, 10, 12, 15] as const;

type MapStyleKey = 'streets' | 'satellite' | 'hybrid' | 'outdoor';

interface MapPost extends Tag {
  title?: string;
  type?: string;
  imageUrl?: string;
}

interface MapPostProperties {
  id: string;
  title: string;
  type: string;
  imageUrl: string;
  hoodId: string;
  username: string;
}

interface MapViewportQuery {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
  hoodId: string;
}

interface NominatimSearchResult {
  lat: string;
  lon: string;
  display_name?: string;
}

interface ClusterFeatureProperties {
  cluster_id?: number;
}

type HoodBoundaryGeometry = Polygon | MultiPolygon;

@Component({
  selector: 'app-hood',
  templateUrl: './hood.html',
  styleUrls: ['./hood.scss'],
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HoodPage implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true })
  private readonly mapContainer?: ElementRef<HTMLDivElement>;

  private readonly http    = inject(HttpClient);
  private readonly ngZone  = inject(NgZone);
  private readonly router  = inject(Router);
  private readonly route   = inject(ActivatedRoute);
  private readonly state   = inject(SharedStateService);
  private readonly store   = inject(Store);
  private readonly toast   = inject(ToastService);
  private readonly supabase = inject(SupabaseService);
  private readonly preload  = inject(PreloadService);

  private readonly destroy$        = new Subject<void>();
  private readonly viewportChange$ = new Subject<MapViewportQuery>();
  private readonly boundaryCache   = new globalThis.Map<string, PlaceBoundary>();

  // Preload MapLibre as soon as the router loads this chunk (before ngAfterViewInit).
  private static readonly _maplibrePromise = import('maplibre-gl');
  private static readonly POSTS_CACHE_TTL  = 60_000;

  private maplibre?: typeof import('maplibre-gl');
  private map?: MapLibreMap;
  private temporaryMarker?: Marker;
  private resizeObserver?: ResizeObserver;
  private locationSelectionEnabled = false;
  private mapErrorShown            = false;
  private mapInitialized           = false;

  private readonly postsCache   = new globalThis.Map<string, { posts: MapPost[]; ts: number }>();
  private readonly reverseCache = new globalThis.Map<string, string>();
  private readonly geocodeCache = new globalThis.Map<string, NominatimSearchResult[]>();

  isSearching      = signal(false);
  countryMode      = signal(false);
  showInfo         = signal(false);
  showMapFilters   = signal(false);
  showLayerMenu    = signal(false);
  showStylePanel   = signal(false);
  postsVisible     = signal(true);
  boundaryVisible  = signal(true);
  /** True when opened from the Post page via ?pick=1 */
  pickMode         = signal(false);
  /** True once the user has tapped the map in pick mode */
  locationPicked   = signal(false);
  currentStyle     = signal<MapStyleKey>('streets');
  readonly zoomLevels = ZOOM_LEVELS;
  readonly MAP_STYLES: { key: MapStyleKey; label: string }[] = [
    { key: 'streets',   label: 'Streets'   },
    { key: 'satellite', label: 'Satellite' },
    { key: 'hybrid',    label: 'Hybrid'    },
    { key: 'outdoor',   label: 'Outdoor'   },
  ];
  selected = signal(DEFAULT_ZOOM);
  hood     = this.store.selectSignal(selectHood);

  async ngAfterViewInit(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!this.supportsWebGl()) {
      this.showUserError('This browser cannot start the map because WebGL is unavailable.');
      return;
    }

    const isPick =
      this.route.snapshot.queryParamMap.get('pick') === '1' ||
      new URLSearchParams(window.location.search).get('pick') === '1' ||
      this.state.pickModeActive();
    if (isPick) {
      this.pickMode.set(true);
      this.state.pickModeActive.set(false);
    }

    this.registerViewportRequests();
    const maplibreModule = await HoodPage._maplibrePromise;
    this.maplibre = (maplibreModule.default ?? maplibreModule) as typeof import('maplibre-gl');

    this.ngZone.runOutsideAngular(() => this.initializeMap());
  }

  select(value: number): void {
    this.selected.set(value);
    this.map?.easeTo({ zoom: value, duration: 250 });
  }

  onCountryModeChange(): void { this.loadVisiblePosts(); }
  toggleInfo(): void          { this.showInfo.update((v) => !v); }

  recenter(): void {
    const coords = this.hood().coords;
    this.map?.flyTo({ center: [coords.lng, coords.lat], zoom: this.selected(), essential: true });
    this.toast.show('Map recentered to your current hood.', 'success');
  }

  refreshMap(): void {
    this.loadVisiblePosts();
    void this.setBoundary(this.hood().name, false);
    this.toast.show('Map refreshed.', 'success');
  }

  toggleMapFilters(): void {
    this.showMapFilters.update((v) => !v);
    this.showLayerMenu.set(false);
    this.showStylePanel.set(false);
  }

  toggleLayerMenu(): void {
    this.showLayerMenu.update((v) => !v);
    this.showMapFilters.set(false);
    this.showStylePanel.set(false);
  }

  toggleStylePanel(): void {
    this.showStylePanel.update((v) => !v);
    this.showLayerMenu.set(false);
    this.showMapFilters.set(false);
  }

  setMapStyle(styleKey: MapStyleKey): void {
    this.showStylePanel.set(false);
    if (this.currentStyle() === styleKey || !this.map) return;
    this.currentStyle.set(styleKey);
    // The 'style.load' handler in initializeMap() re-adds all sources/layers automatically.
    this.ngZone.runOutsideAngular(() => this.map!.setStyle(this.getStyleUrl(styleKey)));
  }

  togglePostsLayer(): void {
    this.postsVisible.update((v) => !v);
    this.setLayerVisibility([CLUSTERS_LAYER, CLUSTER_COUNT_LAYER, INDIVIDUAL_POSTS_LAYER], this.postsVisible());
  }

  toggleBoundaryLayer(): void {
    this.boundaryVisible.update((v) => !v);
    this.setLayerVisibility([HOOD_FILL_LAYER, HOOD_LINE_LAYER], this.boundaryVisible());
  }

  clearSelection(): void {
    this.temporaryMarker?.remove();
    this.temporaryMarker = undefined;
    this.disableLocationSelection();
    this.state.clear();
    this.toast.show('Map selection cleared.', 'info');
  }

  locateMe(): void {
    if (!navigator.geolocation) {
      this.showUserError('Geolocation is not supported by your browser.');
      return;
    }

    this.isSearching.set(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.isSearching.set(false);
        const { latitude: lat, longitude: lng } = position.coords;
        if (!this.isValidCoordinate(lat, lng)) {
          this.showUserError('Invalid coordinates retrieved.');
          return;
        }
        this.map?.flyTo({ center: [lng, lat], zoom: 14, essential: true });
        this.enableLocationSelection();
        this.setTemporaryMarker(lng, lat);
        this.state.updateCoordinates(lat, lng);
        this.getAddressFromCoords(lat, lng);
        this.loadVisiblePosts();
      },
      () => this.showUserError('Unable to retrieve your location. Please check your browser permissions.'),
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    );
  }

  search(value: string): void {
    const q = value?.trim();
    if (!q) return;

    const cachedGeo = this.geocodeCache.get(q.toLowerCase());
    if (cachedGeo?.length) { this.applyGeocodingResult(cachedGeo, q); return; }

    this.isSearching.set(true);
    this.setBoundary(q, true);

    this.http
      .get<NominatimSearchResult[]>(`/api/nominatim/search?q=${encodeURIComponent(q)}`)
      .pipe(
        takeUntil(this.destroy$),
        catchError((err: unknown) => {
          this.isSearching.set(false);
          this.showUserError('Geocoding failed. Please try another location.');
          return of([]);
        })
      )
      .subscribe((res) => {
        this.isSearching.set(false);
        if (res.length) this.geocodeCache.set(q.toLowerCase(), res);
        this.applyGeocodingResult(res, q);
      });
  }

  getAddressFromCoords(lat: number, lon: number): void {
    const key    = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = this.reverseCache.get(key);
    if (cached) { this.state.updateText(cached); return; }

    // Use take(1) so the HTTP request completes even if the user navigates
    // away (clicking Done) before the reverse-geocoding response arrives.
    this.http
      .get<{ display_name?: string }>(`/api/nominatim/reverse?lat=${lat}&lon=${lon}`)
      .pipe(
        take(1),
        catchError(() => of({ display_name: undefined }))
      )
      .subscribe((res) => {
        const name = res.display_name ?? 'Unknown location';
        this.reverseCache.set(key, name);
        this.state.updateText(name);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanupMap();
  }

  // ---------- private ----------

  private initializeMap(): void {
    if (!this.maplibre || !this.mapContainer?.nativeElement) return;

    const coords = this.hood().coords;
    if (!environment.mapTilerApiKey) {
      this.showUserError('MapTiler API key is missing. Add it to the Angular environment.');
    }

    this.map = new this.maplibre.Map({
      container:    this.mapContainer.nativeElement,
      style:        `https://api.maptiler.com/maps/streets-v4/style.json?key=${environment.mapTilerApiKey}`,
      center:       [coords.lng, coords.lat],
      zoom:         DEFAULT_ZOOM,
      minZoom:      4,
      maxZoom:      18,
      fadeDuration: 150,
      renderWorldCopies: false,
      dragRotate:        false,
      pitchWithRotate:   false,
      attributionControl: { compact: true },
    });

    this.map.addControl(new this.maplibre.NavigationControl({ showCompass: false }), 'bottom-right');

    // 'style.load' fires as soon as the style JSON + sprites are ready —
    // no tile rendering required. This means it fires even in headless/offscreen
    // environments. It also re-fires after setStyle() calls, letting us
    // rebuild sources/layers automatically on map style switches.
    // 'style.load' fires as soon as the style JSON + sprites are ready —
    // no tile rendering required. This means it fires even in headless/offscreen
    // environments. It also re-fires after setStyle() calls, letting us
    // rebuild sources/layers automatically on map style switches.
    this.map.on('style.load', () => {
      const firstLoad = !this.mapInitialized;
      if (firstLoad) {
        this.mapInitialized = true;
        this.registerMapEvents();
        this.syncSelectedZoom();
        this.map?.resize();
      }

      // Re-add sources/layers on every style load (initial + after setStyle).
      this.addBoundarySourceAndLayers();
      this.addPostSourceAndLayers();
      void this.setBoundary(this.hood().name, false);
      this.loadVisiblePosts();

      // Instantly paint pre-fetched markers on first load.
      if (firstLoad) {
        const preloaded = this.preload.getHoodPosts();
        if (preloaded?.length) {
          this.updatePostSource(preloaded as MapPost[]);
          const b   = this.map!.getBounds();
          const key = `${b.getWest().toFixed(2)},${b.getSouth().toFixed(2)},${b.getEast().toFixed(2)},${b.getNorth().toFixed(2)}`;
          this.postsCache.set(key, { posts: preloaded as MapPost[], ts: Date.now() });
        }
      }

      // Enable pick mode cursor + click handling as soon as style is ready.
      if (this.pickMode() && !this.locationSelectionEnabled) {
        this.enableLocationSelection();
      }
    });

    this.map.on('error', (event) => {
      if (!this.mapErrorShown) {
        this.mapErrorShown = true;
        this.showUserError('The map style could not be loaded. Please check the MapTiler API key.');
      }
    });

    this.resizeObserver = new ResizeObserver(() => this.map?.resize());
    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }

  private addPostSourceAndLayers(): void {
    if (!this.map) return;

    if (!this.map.getSource(POSTS_SOURCE)) {
      this.map.addSource(POSTS_SOURCE, {
        type: 'geojson',
        data: this.emptyPointCollection(),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 45,
      });
    }

    if (!this.map.getLayer(CLUSTERS_LAYER)) {
      this.map.addLayer({
        id: CLUSTERS_LAYER,
        type: 'circle',
        source: POSTS_SOURCE,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#2b7de9', 25, '#f5a623', 100, '#e14b3b'],
          'circle-radius': ['step', ['get', 'point_count'], 16, 25, 22, 100, 30],
          'circle-opacity': 0.88,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
    }

    if (!this.map.getLayer(CLUSTER_COUNT_LAYER)) {
      this.map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: 'symbol',
        source: POSTS_SOURCE,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
        },
        paint: { 'text-color': '#ffffff' },
      });
    }

    if (!this.map.getLayer(INDIVIDUAL_POSTS_LAYER)) {
      this.map.addLayer({
        id: INDIVIDUAL_POSTS_LAYER,
        type: 'circle',
        source: POSTS_SOURCE,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#ff5a3d',
          'circle-radius': 7,
          'circle-opacity': 0.92,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
    }
  }

  private addBoundarySourceAndLayers(): void {
    if (!this.map) return;

    if (!this.map.getSource(HOOD_SOURCE)) {
      this.map.addSource(HOOD_SOURCE, { type: 'geojson', data: this.emptyBoundaryCollection() });
    }

    if (!this.map.getLayer(HOOD_FILL_LAYER)) {
      this.map.addLayer({
        id: HOOD_FILL_LAYER,
        type: 'fill',
        source: HOOD_SOURCE,
        paint: { 'fill-color': '#007bff', 'fill-opacity': 0.1 },
      });
    }

    if (!this.map.getLayer(HOOD_LINE_LAYER)) {
      this.map.addLayer({
        id: HOOD_LINE_LAYER,
        type: 'line',
        source: HOOD_SOURCE,
        paint: { 'line-color': '#007bff', 'line-width': 2 },
      });
    }
  }

  private registerMapEvents(): void {
    if (!this.map) return;

    this.map.on('moveend', () => this.loadVisiblePosts());
    this.map.on('zoomend', () => this.ngZone.run(() => this.syncSelectedZoom()));
    this.map.on('click', (event) => this.handleMapClick(event));
    this.map.on('click', CLUSTERS_LAYER, (event) => void this.handleClusterClick(event));
    this.map.on('click', INDIVIDUAL_POSTS_LAYER, (event) => this.handleMarkerClick(event));
    this.map.on('mouseenter', CLUSTERS_LAYER, () => this.setCursor('pointer'));
    this.map.on('mouseleave', CLUSTERS_LAYER, () => this.setCursorForMode());
    this.map.on('mouseenter', INDIVIDUAL_POSTS_LAYER, () => this.setCursor('pointer'));
    this.map.on('mouseleave', INDIVIDUAL_POSTS_LAYER, () => this.setCursorForMode());
  }

  private registerViewportRequests(): void {
    this.viewportChange$
      .pipe(
        debounceTime(300),
        switchMap((query) =>
          this.fetchPostsForViewport(query).pipe(
            catchError((err: unknown) => {
              this.showUserError('Could not load posts for this map area.');
              return of([]);
            })
          )
        ),
        takeUntil(this.destroy$)
      )
      .subscribe((posts) => this.updatePostSource(posts));
  }

  private fetchPostsForViewport(query: MapViewportQuery) {
    const key    = `${query.west.toFixed(2)},${query.south.toFixed(2)},${query.east.toFixed(2)},${query.north.toFixed(2)}`;
    const cached = this.postsCache.get(key);
    if (cached && Date.now() - cached.ts < HoodPage.POSTS_CACHE_TTL) {
      return of(cached.posts.filter((p) => this.matchesCountryMode(p)));
    }
    return this.supabase
      .fetchTagsInBounds(query.west, query.south, query.east, query.north)
      .pipe(
        map(({ data }) => {
          const posts = (data ?? []).map(rowToTag) as MapPost[];
          this.postsCache.set(key, { posts, ts: Date.now() });
          return posts.filter((p) => this.matchesCountryMode(p));
        })
      );
  }

  private loadVisiblePosts(): void {
    if (!this.map) return;
    const b = this.map.getBounds();
    this.viewportChange$.next({
      west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth(),
      zoom: this.map.getZoom(), hoodId: this.hood().id,
    });
  }

  private updatePostSource(posts: MapPost[]): void {
    const source = this.map?.getSource(POSTS_SOURCE) as GeoJSONSource | undefined;
    source?.setData(this.convertPostsToGeoJson(posts));
  }

  private convertPostsToGeoJson(posts: MapPost[]): FeatureCollection<Point, MapPostProperties> {
    return {
      type: 'FeatureCollection',
      features: posts
        .filter((p) => this.isValidCoordinate(p.lat, p.lng))
        .map((p, i) => ({
          type: 'Feature',
          properties: {
            id:       p.id ?? `${p.userId}-${p.createdAt}-${i}`,
            title:    p.title ?? p.highlight ?? '',
            type:     p.type  ?? p.tag ?? '',
            imageUrl: p.imageUrl ?? p.images?.[0] ?? '',
            hoodId:   p.hoodId  ?? '',
            username: p.username ?? '',
          },
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        })),
    };
  }

  private async setBoundary(name: string, fitToBoundary: boolean): Promise<void> {
    if (!this.map) return;
    try {
      const boundary = await this.getPlaceBoundary(name);
      if (!boundary) return;
      this.updateBoundarySource(boundary.geometry, name);
      if (fitToBoundary) this.fitBoundary(boundary.bounds);
    } catch {
      this.showUserError('Could not load the neighbourhood boundary.');
    }
  }

  private async getPlaceBoundary(name: string): Promise<PlaceBoundary | null> {
    const key    = name.trim().toLowerCase();
    const cached = this.boundaryCache.get(key);
    if (cached) return cached;
    const boundary = await Utils.getPlaceBoundary(name);
    if (boundary) this.boundaryCache.set(key, boundary);
    return boundary;
  }

  private updateBoundarySource(geometry: HoodBoundaryGeometry, name: string): void {
    const source = this.map?.getSource(HOOD_SOURCE) as GeoJSONSource | undefined;
    source?.setData({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { name }, geometry }],
    } satisfies FeatureCollection<HoodBoundaryGeometry>);
  }

  private fitBoundary(bounds: LngLatBoundsLike): void {
    this.map?.fitBounds(bounds, { padding: 32, duration: 450, maxZoom: 14 });
  }

  private applyGeocodingResult(res: NominatimSearchResult[], q: string): void {
    this.isSearching.set(false);
    if (!res.length) { this.showUserError('Location not found.'); return; }

    const first = res[0];
    const lat   = Number.parseFloat(first.lat);
    const lng   = Number.parseFloat(first.lon);
    if (!this.isValidCoordinate(lat, lng)) {
      this.showUserError('The selected location has invalid coordinates.');
      return;
    }

    const hood = new Hood({ name: q, coords: { lat, lng } });
    this.store.dispatch(setUserPreference({ pref: { hood, mapZoom: 13 } }));
    this.map?.flyTo({ center: [lng, lat], zoom: 13, essential: true });
    this.enableLocationSelection();
    this.setTemporaryMarker(lng, lat);
    this.state.updateCoordinates(lat, lng);
    this.state.updateText(first.display_name ?? q);
    this.loadVisiblePosts();
  }

  private syncSelectedZoom(): void {
    const zoom = this.map?.getZoom();
    if (zoom === undefined) return;
    this.selected.set(ZOOM_LEVELS.reduce((n, v) => Math.abs(v - zoom) < Math.abs(n - zoom) ? v : n));
  }

  private matchesCountryMode(post: MapPost): boolean {
    if (!this.countryMode()) return true;
    const selected = this.hood().country || 'India';
    if (post.country) return post.country.toLowerCase() === selected.toLowerCase();
    return this.isInCountryBounds(post.lat, post.lng, selected);
  }

  private isInCountryBounds(lat: number, lng: number, country: string): boolean {
    if (country.trim().toLowerCase() !== 'india') return true;
    return lat >= 6.5 && lat <= 37.1 && lng >= 68.1 && lng <= 97.4;
  }

  private enableLocationSelection(): void  { this.locationSelectionEnabled = true;  this.setCursorForMode(); }
  private disableLocationSelection(): void { this.locationSelectionEnabled = false; this.setCursorForMode(); }

  private handleMapClick(event: MapMouseEvent): void {
    if (!this.locationSelectionEnabled) return;
    const { lng, lat } = event.lngLat;
    if (!this.isValidCoordinate(lat, lng)) return;
    this.ngZone.run(() => {
      this.setTemporaryMarker(lng, lat);
      this.state.updateCoordinates(lat, lng);
      this.getAddressFromCoords(lat, lng);
      if (this.pickMode()) this.locationPicked.set(true);
    });
  }

  donePickingLocation(): void {
    void this.router.navigate(['/post']);
  }

  private async handleClusterClick(event: MapLayerMouseEvent): Promise<void> {
    if (!this.map) return;
    const feature = event.features?.[0] as Feature<Point, ClusterFeatureProperties> | undefined;
    if (!feature) return;
    const clusterId = feature.properties?.cluster_id;
    const [lng, lat] = feature.geometry.coordinates;
    if (clusterId === undefined || lng === undefined || lat === undefined) return;
    const source = this.map.getSource(POSTS_SOURCE) as GeoJSONSource | undefined;
    if (!source) return;
    const zoom = await source.getClusterExpansionZoom(clusterId);
    this.map.easeTo({ center: [lng, lat], zoom, duration: 600 });
  }

  private handleMarkerClick(event: MapLayerMouseEvent): void {
    if (!this.map || !this.maplibre) return;
    const feature = event.features?.[0] as Feature<Point, MapPostProperties> | undefined;
    if (!feature) return;
    this.ngZone.run(() => {
      const [lng, lat] = feature.geometry.coordinates;
      if (lng === undefined || lat === undefined) return;
      const title    = feature.properties.title || 'Tag post';
      const username = feature.properties.username ? ` by ${feature.properties.username}` : '';
      new this.maplibre!.Popup({ closeButton: true, offset: 12 })
        .setLngLat([lng, lat])
        .setHTML(`<strong>${this.escapeHtml(title)}</strong><br><span>${this.escapeHtml(feature.properties.type)}${this.escapeHtml(username)}</span>`)
        .addTo(this.map!);
    });
  }

  private setTemporaryMarker(lng: number, lat: number): void {
    if (!this.map || !this.maplibre) return;
    if (!this.temporaryMarker) {
      this.temporaryMarker = new this.maplibre.Marker({
        draggable: true,
        element: this.createTemporaryMarkerElement(),
      }).addTo(this.map);

      this.temporaryMarker.on('dragend', () => {
        const lngLat = this.temporaryMarker?.getLngLat();
        if (!lngLat || !this.isValidCoordinate(lngLat.lat, lngLat.lng)) return;
        this.ngZone.run(() => {
          this.state.updateCoordinates(lngLat.lat, lngLat.lng);
          this.getAddressFromCoords(lngLat.lat, lngLat.lng);
        });
      });
    }
    this.temporaryMarker.setLngLat([lng, lat]);
  }

  private createTemporaryMarkerElement(): HTMLElement {
    const el   = document.createElement('img');
    el.src     = 'assets/icons/loc-pin.svg';
    el.alt     = 'Selected location';
    el.className = 'selected-location-marker';
    return el;
  }

  private setCursor(cursor: string): void {
    const canvas = this.map?.getCanvas();
    if (canvas) canvas.style.cursor = cursor;
  }

  private setCursorForMode(): void {
    this.setCursor(this.locationSelectionEnabled ? 'crosshair' : '');
  }

  private setLayerVisibility(layerIds: string[], visible: boolean): void {
    if (!this.map) return;
    for (const id of layerIds) {
      if (this.map.getLayer(id)) {
        this.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      }
    }
  }

  private isValidCoordinate(lat: number, lng: number): boolean {
    return Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  private emptyPointCollection(): FeatureCollection<Point, MapPostProperties> {
    return { type: 'FeatureCollection', features: [] };
  }

  private emptyBoundaryCollection(): FeatureCollection<HoodBoundaryGeometry> {
    return { type: 'FeatureCollection', features: [] };
  }

  private escapeHtml(value: string): string {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }

  private showUserError(message: string): void {
    this.ngZone.run(() => this.toast.show(message, 'danger'));
  }

  private supportsWebGl(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch { return false; }
  }

  private getStyleUrl(style: MapStyleKey): string {
    const key = environment.mapTilerApiKey;
    const urls: Record<MapStyleKey, string> = {
      streets:   `https://api.maptiler.com/maps/streets-v4/style.json?key=${key}`,
      satellite: `https://api.maptiler.com/maps/satellite/style.json?key=${key}`,
      hybrid:    `https://api.maptiler.com/maps/hybrid/style.json?key=${key}`,
      outdoor:   `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${key}`,
    };
    return urls[style];
  }

  private cleanupMap(): void {
    this.disableLocationSelection();
    this.mapInitialized = false;
    this.resizeObserver?.disconnect();
    this.temporaryMarker?.remove();
    this.temporaryMarker = undefined;
    this.map?.remove();
    this.map = undefined;
  }
}
