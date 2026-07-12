import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
  Position,
} from 'geojson';
import type {
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MapLibreMap,
  MapMouseEvent,
} from 'maplibre-gl';

import {
  addClassificationLayers,
  buildClassificationReport,
  describeFeaturesAt,
  inspectMapStyle,
  type ClassificationReport,
} from './map-inspector';
import { environment } from '../../../../environments/environment';
import { PlaceBoundary, Utils } from '../../../../core/services/utils.service';
import { readLocalStorage, writeLocalStorage } from '../../../../core/utils/local-storage.util';

// ── Hardcoded district ────────────────────────────────────────────────────────
// The island view is pinned to Marathahalli (Bengaluru) for now. `HOOD_QUERY`
// is what Nominatim resolves; `HOOD_CENTER` is the boot-time camera position
// used while the boundary is still loading.
const HOOD_LABEL  = 'Marathahalli';
const HOOD_QUERY  = 'Marathahalli, Bengaluru';
const HOOD_CENTER: [number, number] = [77.7011, 12.9569]; // [lng, lat]

// Same localStorage key as the Map tab — a boundary cached by either page is
// instantly available to the other.
const BOUNDARY_CACHE_KEY = 'tagmate_boundary_cache';

// ── Source / layer IDs ────────────────────────────────────────────────────────
// Prefixed "hi-" (hood-island) to avoid any collision with the main map tab layers.
const MASK_SRC     = 'hi-mask-src';
const DISTRICT_SRC = 'hi-district-src';
const MASK_LAYER    = 'hi-mask';    // deep ocean fill (the inverse polygon)
const SHADOW_LAYER  = 'hi-shadow';  // darkens the ocean further at low zoom
const SHALLOW_LAYER = 'hi-shallow'; // wide shallow-water band hugging the coast
const FOAM_LAYER    = 'hi-foam';    // pale surf/foam line at the waterline
const SAND_LAYER    = 'hi-sand';    // sandy beach strip just inside the coast
const BUILDINGS_3D_LAYER = 'hi-3d-buildings'; // optional fill-extrusion layer

type DistrictGeometry = Polygon | MultiPolygon;

// ── Base map styles (MapTiler) ────────────────────────────────────────────────

interface BaseStyle {
  key:   string;
  label: string;
  path:  string; // maps/{path}/style.json
}

const BASE_STYLES: BaseStyle[] = [
  { key: 'streets',  label: 'Streets',   path: 'streets-v4' },
  { key: 'bright',   label: 'Bright',    path: 'bright-v2'  },
  { key: 'basic',    label: 'Basic',     path: 'basic-v2'   },
  { key: 'outdoor',  label: 'Outdoor',   path: 'outdoor-v2' },
  { key: 'topo',     label: 'Topo',      path: 'topo-v2'    },
  { key: 'satellite',label: 'Satellite', path: 'hybrid'     },
  { key: 'dataviz',  label: 'Dataviz',   path: 'dataviz'    },
];

const TILT_OPTIONS = [
  { label: 'Flat', pitch: 0  },
  { label: '25°',  pitch: 25 },
  { label: '45°',  pitch: 45 },
  { label: '60°',  pitch: 60 },
];

// ── Visual presets ────────────────────────────────────────────────────────────

interface MapPreset {
  key:         string;
  label:       string;
  icon:        string;
  desc:        string;
  baseStyle:   string;
  oceanMode:   string;
  pitch:       number;
  buildings3d: boolean;
  brightness:  number;
  contrast:    number;
  saturation:  number;
  hueRotate:   number;
}

const MAP_PRESETS: MapPreset[] = [
  { key: 'smooth-city', label: 'Smooth City', icon: 'bi-buildings-fill', desc: 'Clean 3D city',
    baseStyle: 'bright',    oceanMode: 'ocean',    pitch: 25, buildings3d: true,
    brightness: 100, contrast: 100, saturation: 100, hueRotate: 0 },
  { key: 'dark-urban',  label: 'Dark Urban',  icon: 'bi-moon-stars-fill', desc: 'Moody night feel',
    baseStyle: 'streets',   oceanMode: 'night',    pitch: 40, buildings3d: true,
    brightness: 82,  contrast: 112, saturation: 80,  hueRotate: 0 },
  { key: 'google',      label: 'Google-ish',  icon: 'bi-geo-fill',        desc: 'Familiar & clean',
    baseStyle: 'bright',    oceanMode: 'tropical', pitch: 0,  buildings3d: false,
    brightness: 105, contrast: 100, saturation: 115, hueRotate: 0 },
  { key: 'satellite',   label: 'Satellite',   icon: 'bi-globe2',          desc: 'Aerial view',
    baseStyle: 'satellite', oceanMode: 'tropical', pitch: 20, buildings3d: false,
    brightness: 100, contrast: 108, saturation: 105, hueRotate: 0 },
  { key: 'cyberpunk',   label: 'Cyberpunk',   icon: 'bi-lightning-charge-fill', desc: 'Neon night city',
    baseStyle: 'streets',   oceanMode: 'neon',     pitch: 35, buildings3d: true,
    brightness: 75,  contrast: 130, saturation: 150, hueRotate: 185 },
  { key: 'outdoor',     label: 'Outdoor',     icon: 'bi-tree-fill',       desc: 'Nature & terrain',
    baseStyle: 'outdoor',   oceanMode: 'tropical', pitch: 10, buildings3d: false,
    brightness: 100, contrast: 100, saturation: 115, hueRotate: 0 },
  { key: 'minimal',     label: 'Minimal',     icon: 'bi-square',          desc: 'Clean & quiet',
    baseStyle: 'basic',     oceanMode: 'ocean',    pitch: 0,  buildings3d: false,
    brightness: 100, contrast: 95,  saturation: 60,  hueRotate: 0 },
  { key: 'vintage',     label: 'Vintage',     icon: 'bi-clock-history',   desc: 'Retro sepia tone',
    baseStyle: 'basic',     oceanMode: 'night',    pitch: 0,  buildings3d: false,
    brightness: 90,  contrast: 95,  saturation: 65,  hueRotate: 15 },
];

// ── Layer visibility groups ───────────────────────────────────────────────────

interface LayerGroup {
  key:   string;
  label: string;
  icon:  string;
  match: (id: string, type: string, sourceLayer: string) => boolean;
}

const LAYER_GROUPS: LayerGroup[] = [
  { key: 'buildings', label: 'Buildings', icon: 'bi-buildings',
    match: (_i, _t, sl) => sl === 'building' },
  { key: 'roads',     label: 'Roads',     icon: 'bi-signpost-fill',
    match: (id, _t, sl) =>
      sl === 'transportation' && !id.includes('rail') && !id.includes('transit') && !id.includes('ferry') },
  { key: 'water',     label: 'Water',     icon: 'bi-droplet-fill',
    match: (_i, _t, sl) => sl === 'water' || sl === 'waterway' },
  { key: 'parks',     label: 'Parks',     icon: 'bi-tree-fill',
    match: (_i, _t, sl) => sl === 'landuse' || sl === 'landcover' || sl === 'park' },
  { key: 'labels',    label: 'Labels',    icon: 'bi-fonts',
    match: (_i, type) => type === 'symbol' },
  { key: 'railways',  label: 'Railways',  icon: 'bi-train-front-fill',
    match: (id, _t, sl) =>
      sl === 'transportation' && (id.includes('rail') || id.includes('transit') || id.includes('ferry')) },
  { key: 'pois',      label: 'POIs',      icon: 'bi-pin-map-fill',
    match: (_i, _t, sl) => sl === 'poi' },
];

// ── Saved visualization templates ─────────────────────────────────────────────
// A template is ONLY a stored configuration — creating/saving one never touches
// the live map. It changes the map exclusively through an explicit Apply.

interface IslandTemplateSettings {
  baseStyle:       string;
  oceanMode:       string;
  pitch:           number;
  buildings3d:     boolean;
  brightness:      number;
  contrast:        number;
  saturation:      number;
  hueRotate:       number;
  layerVisibility: Record<string, boolean>;
}

interface IslandTemplate {
  id:        string;
  name:      string;
  createdAt: number;
  updatedAt: number;
  favorite:  boolean;
  settings:  IslandTemplateSettings;
}

const TEMPLATES_KEY = 'tagmate_island_templates';

// ── Visual ocean modes ────────────────────────────────────────────────────────

interface OceanMode {
  key:     string;
  label:   string;
  ocean:   string;   // MASK_LAYER fill
  shadow:  string;   // SHADOW_LAYER fill
  shallow: string;   // SHALLOW_LAYER line
  foam:    string;   // FOAM_LAYER line
  sand:    string;   // SAND_LAYER line
  bg:      string;   // wrapper CSS background
  swatch:  string;   // preview swatch colour for the UI button
}

const OCEAN_MODES: OceanMode[] = [
  {
    key: 'ocean', label: 'Ocean',
    ocean: '#0b2740', shadow: '#051224',
    shallow: '#2a7f9e', foam: '#cfe8f2', sand: '#e2cf9a',
    bg: '#0b2740', swatch: '#2a7f9e',
  },
  {
    key: 'night', label: 'Night',
    ocean: '#050b14', shadow: '#02050a',
    shallow: '#1a5272', foam: '#8bbdd4', sand: '#7a6c4a',
    bg: '#050b14', swatch: '#1a5272',
  },
  {
    key: 'tropical', label: 'Tropical',
    ocean: '#005f87', shadow: '#003a55',
    shallow: '#00b4d8', foam: '#e0f7fa', sand: '#f5d47e',
    bg: '#005f87', swatch: '#00b4d8',
  },
  {
    key: 'neon', label: 'Neon',
    ocean: '#060018', shadow: '#02000a',
    shallow: '#00e5ff', foam: '#ea80fc', sand: '#ffd740',
    bg: '#060018', swatch: '#00e5ff',
  },
];

// ── Search result ─────────────────────────────────────────────────────────────

interface HoodSearchResult {
  displayName: string;
  shortName:   string;
  type:        string;
  lat:         number;
  lng:         number;
  osmType:     string; // 'N' | 'W' | 'R'
  osmId:       number;
}

// ── Pure geometry helpers (no Angular deps) ────────────────────────────────────

/**
 * Builds an inverted mask Feature: a world-size Polygon whose outer ring is the
 * globe bounding box and whose hole rings are the district's exterior rings.
 * MapLibre fills everything OUTSIDE the district with the mask paint color.
 *
 * Supports both Polygon (one exterior ring) and MultiPolygon (multiple islands).
 *
 * Place your district GeoJSON here:
 *   - Pass a Feature<Polygon> or Feature<MultiPolygon> to `setDistrictGeometry()`
 *   - Or load it automatically via `Utils.getPlaceBoundary(hoodName)` (Nominatim)
 */
function buildInverseMask(geometry: DistrictGeometry): Feature<Polygon> {
  const worldRing: Position[] = [
    [-180, -85.051129],
    [ 180, -85.051129],
    [ 180,  85.051129],
    [-180,  85.051129],
    [-180, -85.051129],
  ];

  // The world outer ring + each district ring as a hole = fills everything outside.
  const rings: Position[][] = [worldRing];
  if (geometry.type === 'Polygon') {
    rings.push(...geometry.coordinates);
  } else {
    // MultiPolygon: each polygon contributes its outer ring as a separate hole.
    geometry.coordinates.forEach((poly) => rings.push(...poly));
  }

  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: rings },
    properties: {},
  };
}

/**
 * Smooths a closed ring using Chaikin's corner-cutting algorithm.
 * Each iteration replaces every vertex with two points at 25% and 75% along
 * the adjoining segments, rounding sharp corners into organic curves.
 */
function chaikinRing(ring: Position[], iterations: number): Position[] {
  let pts = ring;
  // Nominatim rings repeat the first point at the end — drop it while smoothing.
  const closed =
    pts.length > 1 &&
    pts[0][0] === pts[pts.length - 1][0] &&
    pts[0][1] === pts[pts.length - 1][1];
  if (closed) pts = pts.slice(0, -1);

  for (let it = 0; it < iterations; it++) {
    const next: Position[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      next.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25]);
      next.push([ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    pts = next;
  }

  return [...pts, pts[0]]; // re-close the ring
}

/**
 * Returns a copy of the geometry with every ring Chaikin-smoothed.
 * 3 iterations turns Nominatim's sharp survey-line vertices into soft,
 * natural-looking coastline curves (each iteration doubles the point count).
 */
export function smoothGeometry(
  geometry: DistrictGeometry,
  iterations = 3,
): DistrictGeometry {
  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates.map((r) => chaikinRing(r, iterations)),
    };
  }
  return {
    type: 'MultiPolygon',
    coordinates: geometry.coordinates.map((poly) =>
      poly.map((r) => chaikinRing(r, iterations)),
    ),
  };
}

/**
 * Returns the [west, south, east, north] envelope of a Polygon or MultiPolygon.
 * Handles both geometry types by flattening all coordinate arrays.
 */
export function getGeometryBounds(
  geometry: DistrictGeometry,
): [number, number, number, number] {
  const allCoords: Position[] =
    geometry.type === 'Polygon'
      ? geometry.coordinates.flat()
      : geometry.coordinates.flat(2);

  let minLng = Infinity, minLat = Infinity;
  let maxLng = -Infinity, maxLat = -Infinity;

  for (const [lng, lat] of allCoords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Expands a bounds rectangle by `factor` on each side.
 * Default 0.35 = 35% — used for `setMaxBounds` so the user can pan slightly
 * beyond the district edge without the camera jumping hard.
 */
export function padBounds(
  [west, south, east, north]: [number, number, number, number],
  factor = 0.35,
): [number, number, number, number] {
  const dLng = (east - west) * factor;
  const dLat = (north - south) * factor;
  return [
    Math.max(-180,       west  - dLng),
    Math.max(-85.051129, south - dLat),
    Math.min( 180,       east  + dLng),
    Math.min( 85.051129, north + dLat),
  ];
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-hood-island',
  templateUrl: './hood-island.html',
  styleUrls: ['./hood-island.scss'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HoodIslandPage implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true })
  private readonly mapEl?: ElementRef<HTMLDivElement>;

  private readonly ngZone = inject(NgZone);
  readonly router         = inject(Router);

  private readonly destroy$ = new Subject<void>();

  // Pre-load MapLibre at chunk-parse time so it is ready before ngAfterViewInit.
  // Identical pattern to HoodPage — avoids a network round-trip on first render.
  private static readonly _maplibrePromise = import('maplibre-gl');

  private maplibre?: typeof import('maplibre-gl');
  private map?: MapLibreMap;
  private mapReady = false;
  private resizeObserver?: ResizeObserver;

  // ── Map data inspector / adaptive classification ─────────────────────────────
  // When true: clicking the map logs every rendered feature at that point, the
  // loaded style is summarised in the console, and a classification report is
  // built once tiles render. Adaptive layers are added either way — they rely
  // on the report, never on assumed schema.
  private readonly enableMapDataInspector = true;
  private classificationReport: ClassificationReport | null = null;
  private classificationDone = false;
  private classificationAttempts = 0;

  private readonly onInspectClick = (e: MapMouseEvent): void => {
    if (this.map && this.enableMapDataInspector) describeFeaturesAt(this.map, e.point);
  };

  // ── Template signals ──────────────────────────────────────────────────────────
  readonly hoodName      = signal(HOOD_LABEL);
  readonly loading       = signal(true);
  readonly errorMsg      = signal('');

  // Visual mode
  readonly currentMode   = signal('ocean');
  readonly settingsOpen  = signal(false);
  readonly oceanModes    = OCEAN_MODES;
  readonly currentModeConfig = computed(
    () => OCEAN_MODES.find(m => m.key === this.currentMode()) ?? OCEAN_MODES[0]
  );

  // Map style / camera
  readonly baseStyles    = BASE_STYLES;
  readonly tiltOptions   = TILT_OPTIONS;
  readonly baseStyle     = signal('bright');  // default: Bright
  readonly buildings3d   = signal(true);      // default: ON
  readonly tilt          = signal(25);         // default: slight 3D perspective

  // Advanced config panel
  readonly advancedOpen  = signal(false);
  readonly presets       = MAP_PRESETS;
  readonly layerGroups   = LAYER_GROUPS;
  readonly currentPreset = signal('smooth-city');

  // Layer visibility (true = visible)
  readonly layerVisibility = signal<Record<string, boolean>>({
    buildings: true, roads: true, water: true,
    parks: true, labels: true, railways: true, pois: true,
  });

  // Saved templates (hydrated from localStorage in ngAfterViewInit — browser only)
  readonly templates          = signal<IslandTemplate[]>([]);
  readonly newTemplateName    = signal('');
  readonly editingTemplateId  = signal<string | null>(null);
  readonly sortedTemplates    = computed(() =>
    [...this.templates()].sort(
      (a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt
    )
  );

  // CSS appearance filters applied to .island-map
  readonly brightness  = signal(100);
  readonly contrast    = signal(100);
  readonly saturation  = signal(100);
  readonly hueRotate   = signal(0);

  readonly mapFilter = computed(() => {
    const b = this.brightness(), c = this.contrast();
    const s = this.saturation(), h = this.hueRotate();
    if (b === 100 && c === 100 && s === 100 && h === 0) return '';
    const parts: string[] = [];
    if (b !== 100) parts.push(`brightness(${b}%)`);
    if (c !== 100) parts.push(`contrast(${c}%)`);
    if (s !== 100) parts.push(`saturate(${s}%)`);
    if (h !== 0)   parts.push(`hue-rotate(${h}deg)`);
    return parts.join(' ');
  });

  // The hood currently painted — tracks current hood for style-switch reloads
  private currentQuery = HOOD_QUERY;
  private currentLabel = HOOD_LABEL;

  // Search
  readonly searchQuery   = signal('');
  readonly searching     = signal(false);
  readonly searchResults = signal<HoodSearchResult[]>([]);
  readonly searchOpen    = signal(false);

  private searchDebounce?: ReturnType<typeof setTimeout>;

  async ngAfterViewInit(): Promise<void> {
    if (typeof window === 'undefined') return;

    this.templates.set(readLocalStorage<IslandTemplate[]>(TEMPLATES_KEY, []));

    if (!this.supportsWebGl()) {
      this.errorMsg.set('WebGL is not available in this browser.');
      this.loading.set(false);
      return;
    }

    const mod = await HoodIslandPage._maplibrePromise;
    this.maplibre = (mod.default ?? mod) as typeof import('maplibre-gl');

    // All MapLibre work runs outside Angular's zone to avoid unnecessary
    // change-detection cycles from map events.
    this.ngZone.runOutsideAngular(() => this.initMap());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.map?.off('click', this.onInspectClick);
    this.map?.remove();
    this.map = undefined;
  }

  // ── private ──────────────────────────────────────────────────────────────────

  private initMap(): void {
    if (!this.maplibre || !this.mapEl?.nativeElement) return;

    const key = environment.mapTilerApiKey;

    if (!key) {
      this.ngZone.run(() => {
        this.errorMsg.set('MapTiler API key is missing from environment.ts.');
        this.loading.set(false);
      });
      return;
    }

    this.map = new this.maplibre.Map({
      container:   this.mapEl.nativeElement,
      style:       this.styleUrl(this.baseStyle()),
      center:      HOOD_CENTER,
      zoom:        13,
      pitch:       this.tilt(),
      minZoom:     8,
      maxZoom:     18,
      fadeDuration: 150,
      renderWorldCopies: false,
      dragRotate:        true,   // allow rotation for 3D feel
      pitchWithRotate:   true,
      attributionControl: { compact: true },
    });

    // Some MapTiler styles reference sprite icons that fail to resolve (e.g.
    // "road_" shields). MapLibre logs a console error for each unless we supply
    // a placeholder — a 1×1 transparent pixel keeps rendering clean and silent.
    this.map.on('styleimagemissing', (e) => {
      if (!this.map || this.map.hasImage(e.id)) return;
      this.map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
    });

    // style.load fires once the style JSON + sprites are ready (no tile
    // rendering needed) and re-fires on every setStyle() call — same contract
    // as HoodPage. Re-add all sources/layers here so style switches survive.
    this.map.on('style.load', () => {
      if (!this.mapReady) {
        this.mapReady = true;
        this.resizeObserver = new ResizeObserver(() => this.map?.resize());
        this.resizeObserver.observe(this.mapEl!.nativeElement);
      }
      this.addSources();
      this.addLayers();
      this.applyModeToMap(this.currentMode());
      this.syncBuildings3d();
      this.reapplyLayerVisibility();
      void this.loadDistrict();

      if (this.enableMapDataInspector) inspectMapStyle(this.map!);
      // Classification needs rendered tiles — wait for the first idle after
      // each style load, then detect what the tileset really contains and add
      // adaptive layers for exactly that. The timer is a fallback for maps
      // that never fully idle (continuous transitions); the pass itself is
      // guarded so it only runs once per style load.
      this.classificationDone = false;
      this.classificationAttempts = 0;
      this.map!.once('idle', () => this.runClassificationPass());
      setTimeout(() => this.runClassificationPass(), 4000);
    });

    if (this.enableMapDataInspector) {
      this.map.on('click', this.onInspectClick);
      // Dev-only handle for debugging from the browser console.
      (window as unknown as Record<string, unknown>)['__hiMap'] = this.map;
    }

    this.map.on('error', () => {
      if (!this.mapReady) {
        this.ngZone.run(() => {
          this.errorMsg.set('Map style failed to load. Check the MapTiler API key.');
          this.loading.set(false);
        });
      }
    });
  }

  /**
   * Adds GeoJSON sources once per style load.
   * Guards with getSource() prevent duplicate-source errors on style switches.
   */
  private addSources(): void {
    if (!this.map) return;

    // Mask source: holds the inverse polygon (world - district).
    if (!this.map.getSource(MASK_SRC)) {
      this.map.addSource(MASK_SRC, {
        type: 'geojson',
        data: this.emptyPolygonFeature(),
      });
    }

    // District source: holds the raw district boundary for outline layers.
    if (!this.map.getSource(DISTRICT_SRC)) {
      this.map.addSource(DISTRICT_SRC, {
        type: 'geojson',
        data: this.emptyFeatureCollection(),
      });
    }
  }

  /**
   * Adds all island-effect layers in back-to-front order.
   * Every layer guard checks getLayer() to skip duplicates after style reload.
   *
   * Layer stack (bottom → top) — a natural coastline gradient:
   *   MASK_LAYER    – deep ocean fill (inverse polygon)
   *   SHADOW_LAYER  – darkens the open ocean further at low zoom
   *   SHALLOW_LAYER – wide teal shallow-water band hugging the coast
   *   FOAM_LAYER    – thin pale surf line right at the waterline
   *   SAND_LAYER    – warm sandy beach strip just inside the coast
   */
  private addLayers(): void {
    if (!this.map) return;

    // 1. Deep ocean — fills everything outside the district with a sea blue
    //    instead of flat black, so the edge reads as water, not a void.
    if (!this.map.getLayer(MASK_LAYER)) {
      this.map.addLayer({
        id: MASK_LAYER,
        type: 'fill',
        source: MASK_SRC,
        paint: {
          'fill-color': '#0b2740',
          'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            9, 0.97,
            15, 0.92,
          ],
        },
      });
    }

    // 2. Open-ocean depth shade — the farther you zoom out, the deeper and
    //    darker the water looks beyond the shallow coastal band.
    if (!this.map.getLayer(SHADOW_LAYER)) {
      this.map.addLayer({
        id: SHADOW_LAYER,
        type: 'fill',
        source: MASK_SRC,
        paint: {
          'fill-color': '#051224',
          'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            9, 0.45,
            15, 0.10,
          ],
        },
      });
    }

    // 3. Shallow water — a wide, heavily blurred teal band straddling the
    //    coastline. Reads as the seabed shelf around a real island.
    //    IMPORTANT: keep line-width and line-blur ≤ ~60px — wider values
    //    produce star/spike artifacts at sharp polygon vertices.
    if (!this.map.getLayer(SHALLOW_LAYER)) {
      this.map.addLayer({
        id: SHALLOW_LAYER,
        type: 'line',
        source: DISTRICT_SRC,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color':   '#2a7f9e',
          'line-width':   ['interpolate', ['linear'], ['zoom'], 9, 56, 15, 26],
          'line-blur':    ['interpolate', ['linear'], ['zoom'], 9, 52, 15, 24],
          'line-opacity': 0.55,
        },
      });
    }

    // 4. Surf foam — a thin, soft pale line exactly on the waterline.
    if (!this.map.getLayer(FOAM_LAYER)) {
      this.map.addLayer({
        id: FOAM_LAYER,
        type: 'line',
        source: DISTRICT_SRC,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color':   '#cfe8f2',
          'line-width':   ['interpolate', ['linear'], ['zoom'], 9, 8, 15, 4],
          'line-blur':    ['interpolate', ['linear'], ['zoom'], 9, 7, 15, 4],
          'line-opacity': 0.65,
        },
      });
    }

    // 5. Sandy beach — a warm blurred band sitting on top so its inner half
    //    tints the land edge like a beach strip.
    if (!this.map.getLayer(SAND_LAYER)) {
      this.map.addLayer({
        id: SAND_LAYER,
        type: 'line',
        source: DISTRICT_SRC,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color':   '#e2cf9a',
          'line-width':   ['interpolate', ['linear'], ['zoom'], 9, 22, 15, 12],
          'line-blur':    ['interpolate', ['linear'], ['zoom'], 9, 20, 15, 11],
          'line-opacity': 0.50,
        },
      });
    }
  }

  /**
   * Resolves the hardcoded Marathahalli boundary and paints the island.
   *
   * Boundary source order:
   *   1. localStorage cache (shared with the Map tab — instant, no network)
   *   2. Utils.getPlaceBoundary() → Nominatim (then cached for next time)
   *
   * To use your own GeoJSON instead: skip this method and call
   * `applyDistrictGeometry(yourGeometry, 'Label')` directly, e.g. with
   * `import districtJson from './my-district.json'`.
   */
  private async loadDistrict(): Promise<void> {
    try {
      const boundary = this.readCachedBoundary() ?? (await this.fetchAndCacheBoundary());

      if (!boundary) {
        this.ngZone.run(() => {
          this.errorMsg.set(`Boundary not found for "${this.currentLabel}".`);
          this.loading.set(false);
        });
        return;
      }

      this.applyDistrictGeometry(boundary.geometry as DistrictGeometry, this.currentLabel);
    } catch {
      this.ngZone.run(() => {
        this.errorMsg.set('Failed to load the district boundary.');
        this.loading.set(false);
      });
    }
  }

  /** Checks the shared boundary cache under both the query and the label key. */
  private readCachedBoundary(): PlaceBoundary | null {
    const entries = readLocalStorage<[string, PlaceBoundary][]>(BOUNDARY_CACHE_KEY, []);
    const cache   = new Map(entries);
    return (
      cache.get(this.currentQuery.toLowerCase()) ??
      cache.get(this.currentLabel.toLowerCase()) ??
      null
    );
  }

  private async fetchAndCacheBoundary(): Promise<PlaceBoundary | null> {
    const boundary = await Utils.getPlaceBoundary(this.currentQuery);
    if (boundary) {
      const entries = readLocalStorage<[string, PlaceBoundary][]>(BOUNDARY_CACHE_KEY, []);
      const cache   = new Map(entries);
      cache.set(this.currentQuery.toLowerCase(), boundary);
      writeLocalStorage(BOUNDARY_CACHE_KEY, Array.from(cache.entries()));
    }
    return boundary;
  }

  /**
   * Paints the mask + district sources, flies the camera to the district,
   * then locks panning and zoom once the camera animation settles.
   *
   * Call this directly if you are providing your own GeoJSON from outside the
   * component (e.g. from a resolver or an @Input).
   */
  applyDistrictGeometry(geometry: DistrictGeometry, label: string): void {
    if (!this.map) return;

    // Round off the raw administrative boundary's sharp survey-line corners
    // so the coastline reads as natural terrain, not a legal boundary.
    const smoothed = smoothGeometry(geometry, 3);

    const rawBounds    = getGeometryBounds(smoothed);
    const paddedBounds = padBounds(rawBounds);

    // Paint the inverse mask over the ocean area.
    (this.map.getSource(MASK_SRC) as GeoJSONSource).setData(
      buildInverseMask(smoothed),
    );

    // Paint the coastline (used by the shallow-water, foam, and sand layers).
    (this.map.getSource(DISTRICT_SRC) as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: smoothed, properties: { name: label } }],
    } as FeatureCollection);

    // IMPORTANT: clear any previous bounds constraint BEFORE fitting/flying —
    // setMaxBounds from a prior district silently clamps the camera and makes
    // the switch appear to do nothing.
    this.map.setMaxBounds(null);

    // Fit the camera to the district.
    this.map.fitBounds(rawBounds as LngLatBoundsLike, {
      padding:  40,
      duration: 700,
      maxZoom:  15,
    });

    // After the animation settles, lock panning to the padded bounds and
    // prevent zooming out far enough to see the rest of the world.
    this.map.once('moveend', () => {
      const zoom = this.map!.getZoom();
      this.map!.setMaxBounds(paddedBounds as LngLatBoundsLike);
      // Allow zooming out 1.5 levels past the fit zoom — enough to see a bit
      // of the "ocean" border, but not enough to reveal other cities.
      this.map!.setMinZoom(Math.max(8, zoom - 1.5));
    });

    this.ngZone.run(() => {
      this.hoodName.set(label);
      this.loading.set(false);
      this.errorMsg.set('');
    });
  }

  // ── Adaptive classification ───────────────────────────────────────────────────

  /**
   * Scans the rendered viewport, builds the classification report, and adds
   * custom layers for the categories that actually exist in the tileset.
   * Runs once per style load (setStyle wipes the layers; the next idle pass
   * re-detects against the new style's schema and re-adds them).
   */
  private runClassificationPass(): void {
    if (!this.map || !this.mapReady || this.classificationDone) return;
    const report = buildClassificationReport(this.map);
    // Nothing rendered yet (background/throttled tab, tiles still loading) —
    // keep retrying with a cap instead of burning the single pass on nothing.
    if (!report.detectedSourceLayers.length && this.classificationAttempts < 15) {
      this.classificationAttempts++;
      setTimeout(() => this.runClassificationPass(), 3000);
      return;
    }
    this.classificationDone = true;
    this.classificationReport = report;
    if (this.enableMapDataInspector) {
      console.info('[HoodIsland] classification report:', report);
    }
    // Insert below the ocean mask so classified features outside the district
    // stay hidden under the water, matching the 3D-buildings layer placement.
    const added = addClassificationLayers(
      this.map, report,
      this.map.getLayer(MASK_LAYER) ? MASK_LAYER : undefined,
    );
    if (this.enableMapDataInspector && added.length) {
      console.info('[HoodIsland] adaptive layers added:', added);
    }
  }

  // ── Visual settings ──────────────────────────────────────────────────────────
  // The panel intentionally stays open after every change so different
  // style/mode/tilt/3D combinations can be compared without re-opening it.

  applyMode(key: string): void {
    this.currentMode.set(key);
    if (this.mapReady) this.applyModeToMap(key);
  }

  setBaseStyle(key: string): void {
    if (key === this.baseStyle() || !this.map) return;
    this.baseStyle.set(key);
    // setStyle wipes all custom sources/layers; the style.load handler re-adds
    // everything (sources, layers, ocean mode, 3D buildings) and repaints the
    // current hood from the boundary cache.
    const url = this.styleUrl(key);
    this.ngZone.runOutsideAngular(() => this.map!.setStyle(url));
  }

  setTilt(pitch: number): void {
    this.tilt.set(pitch);
    this.ngZone.runOutsideAngular(() =>
      this.map?.easeTo({ pitch, duration: 600 })
    );
  }

  toggleBuildings3d(): void {
    this.buildings3d.update(v => !v);
    this.syncBuildings3d();
  }

  private styleUrl(key: string): string {
    const style = BASE_STYLES.find(s => s.key === key) ?? BASE_STYLES[0];
    return `https://api.maptiler.com/maps/${style.path}/style.json?key=${environment.mapTilerApiKey}`;
  }

  /**
   * Adds or removes the 3D building extrusion layer to match the toggle.
   * Inserted BELOW the ocean mask so buildings outside the district stay
   * hidden under the water — only the island itself grows upward.
   */
  private syncBuildings3d(): void {
    if (!this.map || !this.mapReady) return;
    const want = this.buildings3d();
    const has  = !!this.map.getLayer(BUILDINGS_3D_LAYER);

    if (want && !has) {
      const source = this.findBuildingSource();
      if (!source) return; // style has no building layer to extrude
      this.ngZone.runOutsideAngular(() => {
        this.map!.addLayer(
          {
            id: BUILDINGS_3D_LAYER,
            type: 'fill-extrusion',
            source,
            'source-layer': 'building',
            minzoom: 13,
            paint: {
              // OpenMapTiles building tiles only expose render_height /
              // render_min_height / colour / hide_3d — NOT the OSM building
              // type — so colour by mapped colour first, then by height:
              // low warm (houses) → tall cool (towers).
              'fill-extrusion-color': [
                'case',
                ['has', 'colour'], ['get', 'colour'],
                ['interpolate', ['linear'],
                  ['coalesce', ['get', 'render_height'], 10],
                  4,   '#e9dcc4',   // low-rise — warm sand
                  12,  '#ddd3c4',   // mid-rise — neutral
                  30,  '#c4c9d4',   // high-rise — cool grey-blue
                  80,  '#a9b6cf',   // towers — steel blue
                ],
              ],
              'fill-extrusion-height': [
                'coalesce', ['get', 'render_height'], 10,
              ],
              'fill-extrusion-base': [
                'coalesce', ['get', 'render_min_height'], 0,
              ],
              'fill-extrusion-opacity': 0.85,
            },
          },
          this.map!.getLayer(MASK_LAYER) ? MASK_LAYER : undefined,
        );
      });
    } else if (!want && has) {
      this.ngZone.runOutsideAngular(() => this.map!.removeLayer(BUILDINGS_3D_LAYER));
    }
  }

  /**
   * Finds which vector source feeds the style's own "building" layer.
   * Source names differ between MapTiler styles (openmaptiles vs maptiler_planet),
   * so this is resolved from the loaded style instead of hardcoded.
   */
  private findBuildingSource(): string | null {
    const layers = this.map?.getStyle()?.layers ?? [];
    for (const layer of layers) {
      const l = layer as { 'source-layer'?: string; source?: string };
      if (l['source-layer'] === 'building' && l.source) return l.source;
    }
    return null;
  }

  private applyModeToMap(key: string): void {
    const mode = OCEAN_MODES.find(m => m.key === key);
    if (!mode || !this.map) return;
    this.ngZone.runOutsideAngular(() => {
      this.map!.setPaintProperty(MASK_LAYER,    'fill-color', mode.ocean);
      this.map!.setPaintProperty(SHADOW_LAYER,  'fill-color', mode.shadow);
      this.map!.setPaintProperty(SHALLOW_LAYER, 'line-color', mode.shallow);
      this.map!.setPaintProperty(FOAM_LAYER,    'line-color', mode.foam);
      this.map!.setPaintProperty(SAND_LAYER,    'line-color', mode.sand);
    });
  }

  // ── Search ────────────────────────────────────────────────────────────────────

  onSearchInput(raw: string): void {
    const q = raw.trim();
    this.searchQuery.set(raw);
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    if (q.length < 2) {
      this.searching.set(false);
      this.searchResults.set([]);
      this.searchOpen.set(false);
      return;
    }
    this.searching.set(true);
    this.searchDebounce = setTimeout(() => void this.fetchSearchResults(q), 380);
  }

  private async fetchSearchResults(query: string): Promise<void> {
    try {
      const res = await fetch(`/api/nominatim/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('search failed');
      const places = (await res.json()) as Array<{
        display_name: string; name: string;
        addresstype: string; lat: string; lon: string;
        osm_type: string; osm_id: number;
      }>;
      this.ngZone.run(() => {
        this.searchResults.set(
          places.slice(0, 6).map(p => ({
            displayName: p.display_name,
            shortName:   p.name || p.display_name.split(',')[0],
            type:        p.addresstype ?? 'place',
            lat:         parseFloat(p.lat),
            lng:         parseFloat(p.lon),
            osmType:     (p.osm_type ?? 'node').charAt(0).toUpperCase(),
            osmId:       p.osm_id ?? 0,
          }))
        );
        this.searching.set(false);
        this.searchOpen.set(this.searchResults().length > 0);
      });
    } catch {
      this.ngZone.run(() => {
        this.searching.set(false);
        this.searchResults.set([]);
      });
    }
  }

  async pickSearchResult(result: HoodSearchResult): Promise<void> {
    this.searchQuery.set('');
    this.searchOpen.set(false);
    this.searchResults.set([]);
    // Use OSM ID lookup so we get the exact polygon for the chosen result,
    // not whatever a second name-based search happens to return.
    await this.loadDistrictByOsmId(
      `${result.osmType}${result.osmId}`, result.shortName, [result.lng, result.lat]
    );
  }

  private async loadDistrictByOsmId(
    osmIdStr: string, label: string, approxCenter: [number, number]
  ): Promise<void> {
    if (!this.map) return;
    const cacheKey = `osm:${osmIdStr}`;
    this.currentQuery = cacheKey;
    this.currentLabel = label;
    this.ngZone.run(() => { this.loading.set(true); this.errorMsg.set(''); });
    try {
      const entries = readLocalStorage<[string, PlaceBoundary][]>(BOUNDARY_CACHE_KEY, []);
      const cache   = new Map(entries);
      const cached  = cache.get(cacheKey);

      if (cached) {
        this.applyDistrictGeometry(cached.geometry as DistrictGeometry, label);
        return;
      }

      this.map.setMaxBounds(null);
      this.ngZone.runOutsideAngular(() =>
        this.map!.flyTo({ center: approxCenter, zoom: 13, duration: 500 })
      );

      const res = await fetch(`/api/nominatim/lookup?osm_ids=${encodeURIComponent(osmIdStr)}`);
      if (!res.ok) throw new Error('Lookup failed');
      const results = (await res.json()) as Array<{
        geojson?: { type: string; coordinates: unknown };
        boundingbox?: [string, string, string, string];
      }>;

      if (!results.length) {
        this.ngZone.run(() => {
          this.errorMsg.set(`Boundary not found for "${label}".`);
          this.loading.set(false);
        });
        return;
      }

      const place = results[0];
      const bounds = Utils.getBoundsFromBoundingBox(place.boundingbox);
      if (!bounds) {
        this.ngZone.run(() => {
          this.errorMsg.set(`No bounds found for "${label}".`);
          this.loading.set(false);
        });
        return;
      }

      const geometry: DistrictGeometry =
        place.geojson && (place.geojson.type === 'Polygon' || place.geojson.type === 'MultiPolygon')
          ? (place.geojson as DistrictGeometry)
          : Utils.createRectangleGeometry(place.boundingbox);

      const boundary: PlaceBoundary = { geometry, bounds };
      const fresh = new Map(readLocalStorage<[string, PlaceBoundary][]>(BOUNDARY_CACHE_KEY, []));
      fresh.set(cacheKey, boundary);
      writeLocalStorage(BOUNDARY_CACHE_KEY, Array.from(fresh.entries()));

      this.applyDistrictGeometry(geometry, label);
    } catch {
      this.ngZone.run(() => {
        this.errorMsg.set('Failed to load district boundary.');
        this.loading.set(false);
      });
    }
  }

  onSearchBlur(): void {
    setTimeout(() => this.ngZone.run(() => this.searchOpen.set(false)), 200);
  }

  private async loadDistrictByQuery(
    query: string, label: string, approxCenter: [number, number]
  ): Promise<void> {
    if (!this.map) return;
    this.currentQuery = query;
    this.currentLabel = label;
    this.ngZone.run(() => { this.loading.set(true); this.errorMsg.set(''); });
    try {
      const entries = readLocalStorage<[string, PlaceBoundary][]>(BOUNDARY_CACHE_KEY, []);
      const cache   = new Map(entries);
      const cached  = cache.get(query.toLowerCase());

      if (cached) {
        this.applyDistrictGeometry(cached.geometry as DistrictGeometry, label);
        return;
      }

      this.map.setMaxBounds(null);
      this.ngZone.runOutsideAngular(() =>
        this.map!.flyTo({ center: approxCenter, zoom: 13, duration: 500 })
      );

      const boundary = await Utils.getPlaceBoundary(query);
      if (!boundary) {
        this.ngZone.run(() => {
          this.errorMsg.set(`Boundary not found for "${label}".`);
          this.loading.set(false);
        });
        return;
      }

      const fresh = new Map(
        readLocalStorage<[string, PlaceBoundary][]>(BOUNDARY_CACHE_KEY, [])
      );
      fresh.set(query.toLowerCase(), boundary);
      writeLocalStorage(BOUNDARY_CACHE_KEY, Array.from(fresh.entries()));

      this.applyDistrictGeometry(boundary.geometry as DistrictGeometry, label);
    } catch {
      this.ngZone.run(() => {
        this.errorMsg.set('Failed to load district boundary.');
        this.loading.set(false);
      });
    }
  }

  // ── Presets ───────────────────────────────────────────────────────────────────

  applyPreset(key: string): void {
    const p = MAP_PRESETS.find(x => x.key === key);
    if (!p) return;
    this.currentPreset.set(key);
    // Appearance signals — mapFilter computed picks these up immediately
    this.brightness.set(p.brightness);
    this.contrast.set(p.contrast);
    this.saturation.set(p.saturation);
    this.hueRotate.set(p.hueRotate);
    // Camera
    this.tilt.set(p.pitch);
    this.ngZone.runOutsideAngular(() => this.map?.easeTo({ pitch: p.pitch, duration: 600 }));
    // Ocean mode
    this.currentMode.set(p.oceanMode);
    if (this.mapReady) this.applyModeToMap(p.oceanMode);
    // 3D buildings
    this.buildings3d.set(p.buildings3d);
    if (this.mapReady) this.syncBuildings3d();
    // Base style — setStyle triggers style.load which rebuilds everything
    if (p.baseStyle !== this.baseStyle()) {
      this.setBaseStyle(p.baseStyle);
    }
  }

  // ── Visualization templates ───────────────────────────────────────────────────
  // Save/duplicate/rename/delete/import never touch the live map. Only
  // applyTemplate() changes the map, and only when the user clicks Apply.

  /** Snapshot of every setting the island map supports right now. */
  private captureSettings(): IslandTemplateSettings {
    return {
      baseStyle:       this.baseStyle(),
      oceanMode:       this.currentMode(),
      pitch:           this.tilt(),
      buildings3d:     this.buildings3d(),
      brightness:      this.brightness(),
      contrast:        this.contrast(),
      saturation:      this.saturation(),
      hueRotate:       this.hueRotate(),
      layerVisibility: { ...this.layerVisibility() },
    };
  }

  saveCurrentTemplate(): void {
    const name = this.newTemplateName().trim();
    if (!name) return;
    const now = Date.now();
    this.templates.update(list => [
      { id: this.newTemplateId(), name, createdAt: now, updatedAt: now,
        favorite: false, settings: this.captureSettings() },
      ...list,
    ]);
    this.newTemplateName.set('');
    this.persistTemplates();
  }

  applyTemplate(t: IslandTemplate): void {
    const s = t.settings;
    // Appearance — the mapFilter computed picks these up immediately.
    this.brightness.set(s.brightness);
    this.contrast.set(s.contrast);
    this.saturation.set(s.saturation);
    this.hueRotate.set(s.hueRotate);
    // Camera
    this.tilt.set(s.pitch);
    this.ngZone.runOutsideAngular(() => this.map?.easeTo({ pitch: s.pitch, duration: 600 }));
    // Ocean mode
    this.currentMode.set(s.oceanMode);
    if (this.mapReady) this.applyModeToMap(s.oceanMode);
    // 3D buildings
    this.buildings3d.set(s.buildings3d);
    if (this.mapReady) this.syncBuildings3d();
    // Layer visibility
    this.layerVisibility.set({ ...s.layerVisibility });
    if (this.mapReady) {
      for (const g of LAYER_GROUPS) {
        this.applyLayerGroupVisibility(g.key, s.layerVisibility[g.key] ?? true);
      }
    }
    // Base style last — setStyle triggers style.load which rebuilds everything
    // (including the states set above) for the new style.
    if (s.baseStyle !== this.baseStyle()) this.setBaseStyle(s.baseStyle);
  }

  duplicateTemplate(t: IslandTemplate): void {
    const now = Date.now();
    this.templates.update(list => [
      { ...t, id: this.newTemplateId(), name: `${t.name} copy`,
        favorite: false, createdAt: now, updatedAt: now,
        settings: { ...t.settings, layerVisibility: { ...t.settings.layerVisibility } } },
      ...list,
    ]);
    this.persistTemplates();
  }

  deleteTemplate(id: string): void {
    this.templates.update(list => list.filter(t => t.id !== id));
    this.persistTemplates();
  }

  toggleTemplateFavorite(id: string): void {
    this.templates.update(list =>
      list.map(t => (t.id === id ? { ...t, favorite: !t.favorite } : t))
    );
    this.persistTemplates();
  }

  commitRenameTemplate(id: string, raw: string): void {
    const name = raw.trim();
    this.editingTemplateId.set(null);
    if (!name) return;
    this.templates.update(list =>
      list.map(t => (t.id === id ? { ...t, name, updatedAt: Date.now() } : t))
    );
    this.persistTemplates();
  }

  exportTemplates(): void {
    const blob = new Blob(
      [JSON.stringify(this.templates(), null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tagmate-map-templates.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async onImportTemplates(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as IslandTemplate[];
      if (!Array.isArray(parsed)) return;
      const existing = new Set(this.templates().map(t => t.id));
      const incoming = parsed.filter(
        t => t && typeof t.id === 'string' && typeof t.name === 'string'
          && !!t.settings && !existing.has(t.id)
      );
      if (!incoming.length) return;
      this.templates.update(list => [...incoming, ...list]);
      this.persistTemplates();
    } catch { /* invalid file — ignore silently */ }
  }

  private persistTemplates(): void {
    writeLocalStorage(TEMPLATES_KEY, this.templates());
  }

  private newTemplateId(): string {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // ── Layer visibility ──────────────────────────────────────────────────────────

  toggleLayerGroup(key: string): void {
    const next = !this.layerVisibility()[key];
    this.layerVisibility.update(v => ({ ...v, [key]: next }));
    if (this.mapReady) this.applyLayerGroupVisibility(key, next);
  }

  private applyLayerGroupVisibility(key: string, visible: boolean): void {
    if (!this.map) return;
    const group = LAYER_GROUPS.find(g => g.key === key);
    if (!group) return;
    const vis = visible ? 'visible' : 'none';
    const layers = (this.map.getStyle()?.layers ?? []) as Array<{
      id: string; type: string; 'source-layer'?: string;
    }>;
    this.ngZone.runOutsideAngular(() => {
      for (const layer of layers) {
        if (layer.id.startsWith('hi-')) continue;
        if (group.match(layer.id, layer.type, layer['source-layer'] ?? '')) {
          try { this.map!.setLayoutProperty(layer.id, 'visibility', vis); } catch { /* skip */ }
        }
      }
    });
  }

  private reapplyLayerVisibility(): void {
    const vis = this.layerVisibility();
    for (const group of LAYER_GROUPS) {
      if (!vis[group.key]) this.applyLayerGroupVisibility(group.key, false);
    }
  }

  // ── Camera ────────────────────────────────────────────────────────────────────

  resetBearing(): void {
    this.ngZone.runOutsideAngular(() =>
      this.map?.easeTo({ bearing: 0, duration: 500 })
    );
  }

  // ── helpers ──────────────────────────────────────────────────────────────────

  private emptyPolygonFeature(): Feature<Polygon> {
    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[]] },
      properties: {},
    };
  }

  private emptyFeatureCollection(): FeatureCollection {
    return { type: 'FeatureCollection', features: [] };
  }

  private supportsWebGl(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
      return false;
    }
  }
}
