/** OpenFreeMap Liberty — the Google-Maps-like OSM vector style used by every map. */
export const LIBERTY_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/**
 * Spread into every `new maplibregl.Map({...})` call. Keeps a small in-memory
 * tile cache across zoom levels (repeat pans/zooms reuse tiles instead of
 * re-requesting them) without holding onto enough tiles to strain low-end
 * devices, and skips re-validating tiles that are merely stale rather than
 * expired-and-gone, since the base map doesn't need to be byte-perfect fresh.
 */
export const MAP_PERF_OPTIONS = {
  maxTileCacheZoomLevels: 5,
  refreshExpiredTiles: false,
} as const;
