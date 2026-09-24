import { Injectable } from '@angular/core';
import type { StyleSpecification } from 'maplibre-gl';
import { LIBERTY_STYLE_URL } from './map-defaults';

const PLANET_TILEJSON_URL = 'https://tiles.openfreemap.org/planet';

/** Layers/sources dropped from the stock Liberty style — see optimizeLibertyStyle(). */
const DROPPED_LAYER_IDS = new Set([
  'natural_earth', // relief-shading raster — extra tile requests below z7, invisible at street zoom
  'building-3d', // fill-extrusion; every map here disables pitch, so it never renders in 3D anyway
  'poi_r20', // dense generic-POI icons that compete with our own post/emoji markers
  'poi_r7',
  'road_one_way_arrow', // one-way arrow icons — clutter at z16+
  'road_one_way_arrow_opposite',
  'highway-shield-us-interstate', // US-only route shields, irrelevant clutter elsewhere
  'road_shield_us',
]);
const DROPPED_SOURCE_IDS = new Set(['ne2_shaded']);

interface TileJson {
  tiles: string[];
  minzoom?: number;
  maxzoom?: number;
  bounds?: [number, number, number, number];
}

/**
 * Fetches, trims, and caches the Liberty vector style used by every map in
 * the app (Hood, Neighborhood, feed post-location drawer). Fetched once per
 * session — every caller after the first gets the same resolved object, so
 * only one network round-trip ever happens for the style + its TileJSON.
 */
@Injectable({ providedIn: 'root' })
export class MapStyleService {
  private stylePromise: Promise<StyleSpecification> | null = null;

  /** The optimized Liberty style, fetched once and reused for every map. */
  getLibertyStyle(): Promise<StyleSpecification> {
    if (!this.stylePromise) {
      this.stylePromise = this.loadAndOptimize();
    }
    return this.stylePromise;
  }

  private async loadAndOptimize(): Promise<StyleSpecification> {
    const [style, tileJson] = await Promise.all([
      fetch(LIBERTY_STYLE_URL).then((r) => r.json() as Promise<StyleSpecification>),
      fetch(PLANET_TILEJSON_URL).then((r) => r.json() as Promise<TileJson>),
    ]);

    // Inline the TileJSON directly into the vector source so MapLibre doesn't
    // have to make a second round-trip (fetching `openmaptiles.url`) before
    // it can start requesting tiles.
    const source = style.sources['openmaptiles'];
    if (source && source.type === 'vector') {
      delete (source as { url?: string }).url;
      source.tiles = tileJson.tiles;
      if (tileJson.minzoom !== undefined) source.minzoom = tileJson.minzoom;
      if (tileJson.maxzoom !== undefined) source.maxzoom = tileJson.maxzoom;
      if (tileJson.bounds) source.bounds = tileJson.bounds;
    }

    return optimizeLibertyStyle(style);
  }
}

/**
 * Strips clutter/expensive layers from a Liberty style without changing its
 * overall look — same road/building/water/label palette, fewer things drawn.
 */
export function optimizeLibertyStyle(style: StyleSpecification): StyleSpecification {
  const layers = style.layers.filter((layer) => !DROPPED_LAYER_IDS.has(layer.id));

  // The flat `building` fill layer stops at z14 in stock Liberty because
  // building-3d (fill-extrusion) takes over from there — since we drop the
  // 3D layer, let the flat one keep rendering past z14 instead of buildings
  // just disappearing.
  const buildingLayer = layers.find((layer) => layer.id === 'building');
  if (buildingLayer && 'maxzoom' in buildingLayer) {
    delete (buildingLayer as { maxzoom?: number }).maxzoom;
  }

  const sources = Object.fromEntries(
    Object.entries(style.sources).filter(([id]) => !DROPPED_SOURCE_IDS.has(id)),
  );

  return { ...style, sources, layers };
}
