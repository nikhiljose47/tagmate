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
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { catchError, debounceTime, of, Subject, switchMap, takeUntil } from 'rxjs';
import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Point,
  Polygon,
} from 'geojson';
import type {
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  MapMouseEvent,
  Marker,
} from 'maplibre-gl';

import markersData from '../../data/tags.json';
import { environment } from '../../environments/environment.prod';
import { Hood } from '../../models/hood.model';
import { Tag } from '../../models/tag.model';
import { SharedStateService } from '../../services/shared-state.service';
import { PlaceBoundary, Utils } from '../../services/utils';
import { setUserPreference } from '../../store/user-preferences/user-preference.actions';
import { selectHood } from '../../store/user-preferences/user-preference.selectors';

const POSTS_SOURCE = 'posts-source';
const CLUSTERS_LAYER = 'post-clusters';
const CLUSTER_COUNT_LAYER = 'post-cluster-count';
const INDIVIDUAL_POSTS_LAYER = 'individual-posts';

const HOOD_SOURCE = 'hood-source';
const HOOD_FILL_LAYER = 'hood-fill';
const HOOD_LINE_LAYER = 'hood-line';
const DEFAULT_ZOOM = 12;
const ZOOM_LEVELS = [7, 10, 12, 16] as const;

interface MapPost extends Tag {
  id?: string;
  hoodId?: string;
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
  selector: 'app-tagmate',
  templateUrl: './tagmate.html',
  styleUrls: ['./tagmate.scss'],
  standalone: true,
  imports: [FormsModule, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tagmate implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true })
  private readonly mapContainer?: ElementRef<HTMLDivElement>;

  private readonly http = inject(HttpClient);
  private readonly ngZone = inject(NgZone);
  private readonly state = inject(SharedStateService);
  private readonly store = inject(Store);
  private readonly destroy$ = new Subject<void>();
  private readonly viewportChange$ = new Subject<MapViewportQuery>();
  private readonly boundaryCache = new globalThis.Map<string, PlaceBoundary>();

  private maplibre?: typeof import('maplibre-gl');
  private map?: MapLibreMap;
  private temporaryMarker?: Marker;
  private resizeObserver?: ResizeObserver;
  private locationSelectionEnabled = false;
  private mapErrorShown = false;

  isSearching = signal(false);
  postMode = signal(false);
  countryMode = false;
  showInfo = false;
  readonly zoomLevels = ZOOM_LEVELS;
  selected = DEFAULT_ZOOM;
  hood = this.store.selectSignal(selectHood);

  async ngAfterViewInit(): Promise<void> {
    if (typeof window === 'undefined') return;

    this.registerViewportRequests();
    this.maplibre = await import('maplibre-gl');

    this.ngZone.runOutsideAngular(() => {
      this.initializeMap();
    });
  }

  select(value: number): void {
    this.selected = value;
    this.map?.easeTo({ zoom: value, duration: 250 });
  }

  search(value: string): void {
    const q = value?.trim();
    if (!q) return;

    this.isSearching.set(true);
    this.setBoundary(q, true);
    // Nominatim API Proxy
    const url = `/api/nominatim/search?q=${encodeURIComponent(q)}`;

    this.http
      .get<NominatimSearchResult[]>(url)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: unknown) => {
          this.isSearching.set(false);
          console.error('Geocoding error', error);
          this.showUserError('Geocoding failed. Please try another location.');
          return of([]);
        })
      )
      .subscribe((res) => {
        this.isSearching.set(false);
        if (!res.length) {
          this.showUserError('Location not found.');
          return;
        }

        const first = res[0];
        const lat = Number.parseFloat(first.lat);
        const lng = Number.parseFloat(first.lon);
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
      });
  }

  getAddressFromCoords(lat: number, lon: number) {
    const url = `/api/nominatim/reverse?lat=${lat}&lon=${lon}`;

    this.http
      .get<{ display_name?: string }>(url)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: unknown) => {
          console.error('Reverse geocoding failed', error);
          this.showUserError('Could not resolve the selected address.');
          return of({ display_name: undefined });
        })
      )
      .subscribe((res) => {
        this.state.updateText(res.display_name ?? 'Unknown location');
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanupMap();
  }

  private initializeMap(): void {
    if (!this.maplibre || !this.mapContainer?.nativeElement) return;

    const coords = this.hood().coords;
    const mapTilerApiKey = environment.mapTilerApiKey;
    if (!mapTilerApiKey) {
      this.showUserError('MapTiler API key is missing. Add it to the Angular environment.');
    }

    this.map = new this.maplibre.Map({
      container: this.mapContainer.nativeElement,
      style: `https://api.maptiler.com/maps/streets-v4/style.json?key=${mapTilerApiKey}`,
      center: [coords.lng, coords.lat],
      zoom: DEFAULT_ZOOM,
      minZoom: 4,
      maxZoom: 18,
      fadeDuration: 150,
      renderWorldCopies: false,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: { compact: true },
    });

    this.map.addControl(new this.maplibre.NavigationControl({ showCompass: false }), 'bottom-right');

    this.map.on('load', () => {
      this.addBoundarySourceAndLayers();
      this.addPostSourceAndLayers();
      this.registerMapEvents();
      void this.setBoundary(this.hood().name, false);
      this.loadVisiblePosts();
      this.syncSelectedZoom();
      this.map?.resize();
    });

    this.map.on('error', (event) => {
      console.error('MapLibre error', event.error);
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
        paint: {
          'text-color': '#ffffff',
        },
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
      this.map.addSource(HOOD_SOURCE, {
        type: 'geojson',
        data: this.emptyBoundaryCollection(),
      });
    }

    if (!this.map.getLayer(HOOD_FILL_LAYER)) {
      this.map.addLayer({
        id: HOOD_FILL_LAYER,
        type: 'fill',
        source: HOOD_SOURCE,
        paint: {
          'fill-color': '#007bff',
          'fill-opacity': 0.1,
        },
      });
    }

    if (!this.map.getLayer(HOOD_LINE_LAYER)) {
      this.map.addLayer({
        id: HOOD_LINE_LAYER,
        type: 'line',
        source: HOOD_SOURCE,
        paint: {
          'line-color': '#007bff',
          'line-width': 2,
        },
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
            catchError((error: unknown) => {
              console.error('Failed to load map posts', error);
              this.showUserError('Could not load posts for this map area.');
              return of([]);
            })
          )
        ),
        takeUntil(this.destroy$)
      )
      .subscribe((posts) => {
        this.updatePostSource(posts);
      });
  }

  private fetchPostsForViewport(query: MapViewportQuery) {
    const posts = (markersData as MapPost[]).filter(
      (post) =>
        this.isValidCoordinate(post.lat, post.lng) &&
        post.lng >= query.west &&
        post.lng <= query.east &&
        post.lat >= query.south &&
        post.lat <= query.north
    );

    return of(posts);
  }

  private loadVisiblePosts(): void {
    if (!this.map) return;

    const bounds = this.map.getBounds();
    this.viewportChange$.next({
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
      zoom: this.map.getZoom(),
      hoodId: this.hood().id,
    });
  }

  private updatePostSource(posts: MapPost[]): void {
    const source = this.map?.getSource(POSTS_SOURCE) as GeoJSONSource | undefined;
    if (!source) return;

    source.setData(this.convertPostsToGeoJson(posts));
  }

  private convertPostsToGeoJson(
    posts: MapPost[]
  ): FeatureCollection<Point, MapPostProperties> {
    return {
      type: 'FeatureCollection',
      features: posts
        .filter((post) => this.isValidCoordinate(post.lat, post.lng))
        .map((post, index) => ({
          type: 'Feature',
          properties: {
            id: post.id ?? `${post.userId}-${post.createdAt}-${index}`,
            title: post.title ?? post.highlight ?? '',
            type: post.type ?? post.tag ?? '',
            imageUrl: post.imageUrl ?? post.images?.[0] ?? '',
            hoodId: post.hoodId ?? '',
            username: post.username ?? '',
          },
          geometry: {
            type: 'Point',
            coordinates: [post.lng, post.lat],
          },
        })),
    };
  }

  private async setBoundary(name: string, fitToBoundary: boolean): Promise<void> {
    if (!this.map) return;

    try {
      const boundary = await this.getPlaceBoundary(name);
      if (!boundary) return;

      this.updateBoundarySource(boundary.geometry, name);
      if (fitToBoundary) {
        this.fitBoundary(boundary.bounds);
      }
    } catch (error) {
      console.error('Boundary lookup failed', error);
      this.showUserError('Could not load the neighbourhood boundary.');
    }
  }

  private async getPlaceBoundary(name: string): Promise<PlaceBoundary | null> {
    const cacheKey = name.trim().toLowerCase();
    const cached = this.boundaryCache.get(cacheKey);
    if (cached) return cached;

    const boundary = await Utils.getPlaceBoundary(name);
    if (boundary) this.boundaryCache.set(cacheKey, boundary);
    return boundary;
  }

  private updateBoundarySource(geometry: HoodBoundaryGeometry, name: string): void {
    const source = this.map?.getSource(HOOD_SOURCE) as GeoJSONSource | undefined;
    if (!source) return;

    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name },
          geometry,
        },
      ],
    } satisfies FeatureCollection<HoodBoundaryGeometry>);
  }

  private fitBoundary(bounds: LngLatBoundsLike): void {
    this.map?.fitBounds(bounds, {
      padding: 32,
      duration: 450,
      maxZoom: 14,
    });
  }

  private syncSelectedZoom(): void {
    const zoom = this.map?.getZoom();
    if (zoom === undefined) return;

    this.selected = this.getNearestZoomLevel(zoom);
  }

  private getNearestZoomLevel(zoom: number): number {
    return ZOOM_LEVELS.reduce((nearest, value) =>
      Math.abs(value - zoom) < Math.abs(nearest - zoom) ? value : nearest
    );
  }

  private enableLocationSelection(): void {
    this.locationSelectionEnabled = true;
    this.setCursorForMode();
  }

  private disableLocationSelection(): void {
    this.locationSelectionEnabled = false;
    this.setCursorForMode();
  }

  private handleMapClick(event: MapMouseEvent): void {
    if (!this.locationSelectionEnabled) return;

    const { lng, lat } = event.lngLat;
    if (!this.isValidCoordinate(lat, lng)) return;

    this.ngZone.run(() => {
      this.setTemporaryMarker(lng, lat);
      this.state.updateCoordinates(lat, lng);
      this.getAddressFromCoords(lat, lng);
    });
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
    this.map.easeTo({
      center: [lng, lat],
      zoom,
      duration: 600,
    });
  }

  private handleMarkerClick(event: MapLayerMouseEvent): void {
    if (!this.map || !this.maplibre) return;

    const feature = event.features?.[0] as Feature<Point, MapPostProperties> | undefined;
    if (!feature) return;

    this.ngZone.run(() => {
      const [lng, lat] = feature.geometry.coordinates;
      if (lng === undefined || lat === undefined) return;

      const coordinates: [number, number] = [lng, lat];
      const title = feature.properties.title || 'Tag post';
      const username = feature.properties.username ? ` by ${feature.properties.username}` : '';

      new this.maplibre!.Popup({ closeButton: true, offset: 12 })
        .setLngLat(coordinates)
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
    const element = document.createElement('img');
    element.src = 'assets/icons/loc-pin.svg';
    element.alt = 'Selected location';
    element.className = 'selected-location-marker';
    return element;
  }

  private setCursor(cursor: string): void {
    const canvas = this.map?.getCanvas();
    if (canvas) canvas.style.cursor = cursor;
  }

  private setCursorForMode(): void {
    this.setCursor(this.locationSelectionEnabled ? 'crosshair' : '');
  }

  private isValidCoordinate(lat: number, lng: number): boolean {
    return (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
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
    if (typeof window !== 'undefined') {
      window.alert(message);
    }
  }

  private cleanupMap(): void {
    this.disableLocationSelection();
    this.resizeObserver?.disconnect();
    this.temporaryMarker?.remove();
    this.temporaryMarker = undefined;
    this.map?.remove();
    this.map = undefined;
  }
}
