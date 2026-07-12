/**
 * Map Data Inspector & Adaptive Classification Engine.
 *
 * Inspects the CURRENTLY LOADED MapTiler/MapLibre style and tileset first,
 * then reports what classification data actually exists. Nothing here assumes
 * source-layer names, property names, or property values — everything is
 * discovered from rendered features at runtime, so it works with any
 * compatible vector style.
 */
import type {
  AddLayerObject,
  FilterSpecification,
  Map as MapLibreMap,
  MapGeoJSONFeature,
  PointLike,
} from 'maplibre-gl';

// Properties worth surfacing when inspecting features. Only those that
// actually exist on a feature are ever printed or used.
const INSPECT_PROPS = [
  'class', 'subclass', 'type', 'kind',
  'building', 'building:levels', 'height', 'render_height', 'colour',
  'landuse', 'natural', 'leisure', 'amenity',
  'railway', 'station', 'water', 'waterway', 'shop', 'office',
] as const;

const MAX_VALUES_PER_PROP = 40;

// ── Report types ──────────────────────────────────────────────────────────────

/** One (source, source-layer, property) combination that matched a category. */
export interface CategoryMatch {
  source:      string;
  sourceLayer: string;
  property:    string;
  values:      string[];
}

export interface ClassificationReport {
  detectedSourceLayers:   string[];
  detectedPropertyNames:  string[];
  detectedPropertyValues: Record<string, string[]>;
  buildingsAvailable:      boolean;
  buildingTypesAvailable:  string[];
  parksAvailable:          boolean;
  forestsAvailable:        boolean;
  waterAvailable:          boolean;
  metroRoutesAvailable:    boolean;
  metroStationsAvailable:  boolean;
  /** Category key → every property/value combination found for it. */
  categories: Record<string, CategoryMatch[]>;
}

// ── Category matchers ─────────────────────────────────────────────────────────
// A category exists when ANY of its properties carries ANY of its values on a
// feature with a compatible geometry — never a single hard-coded property.

type CategoryGeometry = 'polygon' | 'line' | 'point';

interface CategoryMatcher {
  key:      string;
  geometry: CategoryGeometry;
  props:    string[];
  values:   string[];
}

const CATEGORY_MATCHERS: CategoryMatcher[] = [
  { key: 'commercial', geometry: 'polygon',
    props:  ['building', 'class', 'subclass', 'type', 'kind', 'landuse', 'shop', 'office', 'amenity'],
    values: ['commercial', 'retail', 'shop', 'mall', 'supermarket', 'kiosk', 'office'] },
  { key: 'apartments', geometry: 'polygon',
    props:  ['building', 'class', 'subclass', 'type', 'kind'],
    values: ['apartments', 'dormitory'] },
  { key: 'residential', geometry: 'polygon',
    props:  ['building', 'class', 'subclass', 'type', 'kind', 'landuse'],
    values: ['residential', 'house', 'detached', 'semidetached_house', 'terrace', 'bungalow'] },
  { key: 'industrial', geometry: 'polygon',
    props:  ['building', 'class', 'subclass', 'type', 'kind', 'landuse'],
    values: ['industrial', 'warehouse', 'factory', 'manufacture', 'works', 'quarry'] },
  { key: 'forest', geometry: 'polygon',
    props:  ['class', 'subclass', 'type', 'kind', 'natural', 'landuse'],
    values: ['forest', 'wood'] },
  { key: 'park', geometry: 'polygon',
    props:  ['class', 'subclass', 'type', 'kind', 'leisure', 'landuse'],
    values: ['park', 'garden', 'grass', 'recreation_ground', 'playground', 'pitch', 'village_green'] },
  { key: 'water', geometry: 'polygon',
    props:  ['class', 'type', 'kind', 'natural', 'water'],
    values: ['water', 'lake', 'river', 'ocean', 'sea', 'pond', 'reservoir', 'swimming_pool'] },
  { key: 'metroRoute', geometry: 'line',
    props:  ['class', 'subclass', 'railway', 'kind'],
    values: ['subway', 'metro', 'light_rail', 'transit', 'rail'] },
  { key: 'metroStation', geometry: 'point',
    props:  ['railway', 'station', 'subclass', 'class', 'kind'],
    values: ['station', 'subway', 'metro', 'halt', 'tram_stop'] },
];

// ── Category visual styles ────────────────────────────────────────────────────

interface CategoryStyle {
  kind:  'fill' | 'line' | 'circle';
  paint: Record<string, unknown>;
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  commercial:  { kind: 'fill',   paint: { 'fill-color': '#d4a017', 'fill-opacity': 0.40 } },
  apartments:  { kind: 'fill',   paint: { 'fill-color': '#f97316', 'fill-opacity': 0.40 } },
  residential: { kind: 'fill',   paint: { 'fill-color': '#c8a37a', 'fill-opacity': 0.35 } },
  industrial:  { kind: 'fill',   paint: { 'fill-color': '#8a8f98', 'fill-opacity': 0.40 } },
  forest:      { kind: 'fill',   paint: { 'fill-color': '#1d6b3c', 'fill-opacity': 0.45 } },
  park:        { kind: 'fill',   paint: { 'fill-color': '#67c26b', 'fill-opacity': 0.40 } },
  water:       { kind: 'fill',   paint: { 'fill-color': '#2f7fd1', 'fill-opacity': 0.45 } },
  metroRoute:  { kind: 'line',   paint: { 'line-color': '#a855f7', 'line-width': 2.5, 'line-opacity': 0.9 } },
  metroStation:{ kind: 'circle', paint: {
    'circle-radius': 5, 'circle-color': '#a855f7',
    'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } },
  genericBuilding: { kind: 'fill', paint: { 'fill-color': '#b3aea6', 'fill-opacity': 0.30 } },
};

export const CLASSIFICATION_LAYER_PREFIX = 'hi-cls-';

// ── Style inspection ──────────────────────────────────────────────────────────

/**
 * Prints a full summary of the loaded style to the console: sources with their
 * types, and every layer with its type, source-layer, filter and paint/layout.
 */
export function inspectMapStyle(map: MapLibreMap): void {
  const style = map.getStyle();
  if (!style) return;

  console.groupCollapsed('[MapInspector] Style summary — sources & layers');

  console.groupCollapsed(`Sources (${Object.keys(style.sources ?? {}).length})`);
  for (const [id, src] of Object.entries(style.sources ?? {})) {
    console.log(`source "${id}"  type=${(src as { type: string }).type}`);
  }
  console.groupEnd();

  const layers = style.layers ?? [];
  console.groupCollapsed(`Layers (${layers.length})`);
  for (const layer of layers) {
    const l = layer as {
      id: string; type: string; source?: string; 'source-layer'?: string;
      filter?: unknown; paint?: unknown; layout?: unknown;
    };
    console.groupCollapsed(
      `${l.id}  [${l.type}]  source=${l.source ?? '-'}  source-layer=${l['source-layer'] ?? '-'}`
    );
    if (l.filter) console.log('filter:', JSON.stringify(l.filter));
    if (l.paint)  console.log('paint:',  l.paint);
    if (l.layout) console.log('layout:', l.layout);
    console.groupEnd();
  }
  console.groupEnd();

  const sourceLayers = [...new Set(
    layers.map(l => (l as { 'source-layer'?: string })['source-layer']).filter(Boolean)
  )];
  console.log('Distinct source-layers referenced by style:', sourceLayers);
  console.groupEnd();
}

// ── Click inspector ───────────────────────────────────────────────────────────

/**
 * Prints every rendered feature at a screen point: layer, source,
 * source-layer, geometry, id, all properties — and the well-known
 * classification properties individually, ONLY when they exist.
 */
export function describeFeaturesAt(map: MapLibreMap, point: PointLike): void {
  const feats = map.queryRenderedFeatures(point);
  console.group(`[MapInspector] ${feats.length} feature(s) at clicked point`);
  for (const f of feats) {
    console.groupCollapsed(
      `${f.layer.id}  [${f.layer.type}]  source-layer=${f.sourceLayer ?? '-'}`
    );
    console.log('source:',        f.source);
    console.log('geometry type:', f.geometry.type);
    if (f.id !== undefined) console.log('feature id:', f.id);
    console.log('all properties:', f.properties);
    for (const prop of INSPECT_PROPS) {
      const v = (f.properties as Record<string, unknown>)?.[prop];
      if (v !== undefined && v !== null) console.log(`${prop}:`, v);
    }
    console.groupEnd();
  }
  console.groupEnd();
}

// ── Classification detection ──────────────────────────────────────────────────

function geometryClass(f: MapGeoJSONFeature): CategoryGeometry {
  const t = f.geometry.type;
  if (t === 'Polygon' || t === 'MultiPolygon') return 'polygon';
  if (t === 'LineString' || t === 'MultiLineString') return 'line';
  return 'point';
}

/**
 * Scans all currently rendered features and reports which source-layers,
 * property names, property values and classifications actually exist in the
 * loaded tileset. Custom "hi-" layers are excluded from the scan.
 */
export function buildClassificationReport(map: MapLibreMap): ClassificationReport {
  const feats = map.queryRenderedFeatures();

  const sourceLayers = new Set<string>();
  const propNames    = new Set<string>();
  const propValues   = new Map<string, Set<string>>();
  // category key → "source|sourceLayer|property" → value set
  const catMatches   = new Map<string, Map<string, Set<string>>>();
  const buildingTypes = new Set<string>();
  let buildingsSeen = false;
  let buildingSource: { source: string; sourceLayer: string } | null = null;

  for (const f of feats) {
    if (f.layer.id.startsWith('hi-')) continue; // skip our own custom layers
    const sl = f.sourceLayer ?? '';
    if (sl) sourceLayers.add(sl);

    const props = (f.properties ?? {}) as Record<string, unknown>;
    for (const name of Object.keys(props)) {
      propNames.add(name);
      const v = props[name];
      if (typeof v === 'string' && v.length < 60) {
        let set = propValues.get(name);
        if (!set) propValues.set(name, (set = new Set()));
        if (set.size < MAX_VALUES_PER_PROP) set.add(v);
      }
    }

    if (sl === 'building' || props['building'] !== undefined) {
      buildingsSeen = true;
      buildingSource ??= { source: f.source, sourceLayer: sl || 'building' };
      const bt = props['building'];
      if (typeof bt === 'string' && bt !== 'yes' && bt !== 'true') buildingTypes.add(bt);
    }

    const geo = geometryClass(f);
    for (const matcher of CATEGORY_MATCHERS) {
      if (matcher.geometry !== geo) continue;
      for (const prop of matcher.props) {
        const v = props[prop];
        if (typeof v !== 'string' || !matcher.values.includes(v)) continue;
        let perCombo = catMatches.get(matcher.key);
        if (!perCombo) catMatches.set(matcher.key, (perCombo = new Map()));
        const comboKey = `${f.source}|${sl}|${prop}`;
        let vals = perCombo.get(comboKey);
        if (!vals) perCombo.set(comboKey, (vals = new Set()));
        vals.add(v);
      }
    }
  }

  const categories: Record<string, CategoryMatch[]> = {};
  for (const [key, perCombo] of catMatches) {
    categories[key] = [...perCombo.entries()].map(([combo, vals]) => {
      const [source, sourceLayer, property] = combo.split('|');
      return { source, sourceLayer, property, values: [...vals].sort() };
    });
  }
  // Generic-buildings fallback target (footprints exist even without types).
  if (buildingsSeen && buildingSource) {
    categories['genericBuilding'] = [{
      source: buildingSource.source, sourceLayer: buildingSource.sourceLayer,
      property: '', values: [],
    }];
  }

  return {
    detectedSourceLayers:   [...sourceLayers].sort(),
    detectedPropertyNames:  [...propNames].sort(),
    detectedPropertyValues: Object.fromEntries(
      [...propValues.entries()].map(([k, v]) => [k, [...v].sort()])
    ),
    buildingsAvailable:     buildingsSeen,
    buildingTypesAvailable: [...buildingTypes].sort(),
    parksAvailable:         !!categories['park']?.length,
    forestsAvailable:       !!categories['forest']?.length,
    waterAvailable:         !!categories['water']?.length || sourceLayers.has('water'),
    metroRoutesAvailable:   !!categories['metroRoute']?.length,
    metroStationsAvailable: !!categories['metroStation']?.length,
    categories,
  };
}

// ── Adaptive layer creation ───────────────────────────────────────────────────

/**
 * Adds a styled layer per detected category — and ONLY for categories the
 * report proves exist. Every layer is verified before creation: source exists,
 * source-layer is known, no duplicate layer id. Uses `coalesce` across every
 * property that was detected for the category, so no single property name is
 * relied upon. The base style is never modified or removed.
 *
 * Fallbacks:
 *  - building footprints without types → one generic building layer
 *  - stations without routes (or vice versa) → only what exists is added
 *  - nothing detected at all → console warning, no layers
 *
 * Returns the ids of the layers actually added.
 */
export function addClassificationLayers(
  map: MapLibreMap,
  report: ClassificationReport,
  beforeId?: string,
): string[] {
  const added: string[] = [];
  const before = beforeId && map.getLayer(beforeId) ? beforeId : undefined;

  const typedBuildingKeys = ['commercial', 'apartments', 'residential', 'industrial'];
  const hasTypedBuildings = typedBuildingKeys.some(k => report.categories[k]?.length);

  for (const [key, style] of Object.entries(CATEGORY_STYLES)) {
    // Generic buildings are a fallback: only when footprints exist but no
    // typed building category was detected.
    if (key === 'genericBuilding' && hasTypedBuildings) continue;

    const matches = report.categories[key];
    if (!matches?.length) continue;

    // One layer per (source, source-layer) combination.
    const bySrc = new Map<string, CategoryMatch[]>();
    for (const m of matches) {
      const k = `${m.source}|${m.sourceLayer}`;
      (bySrc.get(k) ?? bySrc.set(k, []).get(k)!).push(m);
    }

    let i = 0;
    for (const [srcKey, group] of bySrc) {
      const [source, sourceLayer] = srcKey.split('|');

      // Safety checks — never let a bad assumption throw at runtime.
      if (!source || !map.getSource(source)) continue;
      if (!sourceLayer) continue;
      const id = `${CLASSIFICATION_LAYER_PREFIX}${key}-${i++}`;
      if (map.getLayer(id)) continue;

      // coalesce across every property detected for this category, then
      // match against the union of detected values.
      const props  = [...new Set(group.map(m => m.property).filter(Boolean))];
      const values = [...new Set(group.flatMap(m => m.values))];
      const filter: FilterSpecification | undefined = props.length
        ? ['in',
            ['coalesce', ...props.map(p => ['get', p]), ''],
            ['literal', values],
          ] as unknown as FilterSpecification
        : undefined; // genericBuilding: whole source-layer, no filter

      try {
        // `style.kind` is dynamic, so TS can't discriminate the layer union.
        const layerDef = {
          id,
          type: style.kind,
          source,
          'source-layer': sourceLayer,
          ...(filter ? { filter } : {}),
          paint: style.paint,
        } as unknown as AddLayerObject;
        map.addLayer(layerDef, before);
        added.push(id);
      } catch (err) {
        console.warn(`[MapInspector] failed to add layer ${id}`, err);
      }
    }
  }

  if (!added.length) {
    console.warn(
      '[MapInspector] The current tileset exposes no usable classification ' +
      'data (building types, land-use, water, metro). No custom layers added.'
    );
  }
  return added;
}
