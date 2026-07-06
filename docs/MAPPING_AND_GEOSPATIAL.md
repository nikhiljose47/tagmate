# Mapping & Geospatial Documentation

Tagmate leverages high-performance interactive mapping and geocoding resources to render neighborhood posts and define spatial boundaries. This document outlines the mapping stack, clustering implementation, boundary rendering, and caching design.

---

## 🛠️ Technology Stack
* **Map Renderer**: `MapLibre GL JS` (v5.24.0)
* **Map Styles**: `MapTiler` hosted vector styles (Streets, Satellite, Hybrid, Outdoors)
* **Geocoding APIs**: OpenStreetMap `Nominatim` API for forward/reverse geocoding and boundary polygons

---

## 🗺️ Core Components & Features

### 1. Interactive Neighborhood Mapping
The map component (`src/app/features/hood/pages/hood/hood.ts`) handles rendering the map container:
* Uses a `ResizeObserver` to trigger `map.resize()` on sidebar toggle or screen size adjustments to ensure the canvas does not warp.
* Maps custom MapTiler vector styles that align dynamically with the active application theme.

### 2. Geographic Post Clustering
To prevent performance degradation with a high density of posts, Tagmate implements WebGL-based clustering:
* All post coordinates are mapped to a single GeoJSON `FeatureCollection<Point>`.
* The data source is initialized with `{ cluster: true, clusterMaxZoom: 14, clusterRadius: 50 }`.
* Clustered and unclustered posts are rendered using specific WebGL symbol/circle layers:
  * **Clusters**: Displayed as styled circles with count labels. Clicking a cluster invokes `getClusterExpansionZoom()` and flies the viewport into that cluster.
  * **Individual Posts**: Displayed as category-specific pins.

### 3. Dynamic Boundary Polygon Outlines
Neighborhood shapes and boundaries are dynamically calculated using the OSM Nominatim API:
* When a user selects or searches for a neighborhood, a query is sent to Nominatim requesting polygon coordinates (`polygon_geojson=1`).
* The result is parsed and rendered as a semi-transparent `fill` and outline `line` layer matching the neighborhood boundaries.

### 4. Draggable Location Picker
When creating a new post:
* A temporary draggable marker is spawned on the map.
* Moving this marker retrieves the reverse-geocoded address in real-time from Nominatim to display textual feedback to the creator.
* Coordinates are locked on confirmation.

---

## 💾 Caching & Optimization

To comply with OpenStreetMap Nominatim rate limits and reduce network latency:
1. **Front-End Caching**: Reverse-geocoded text and neighborhood boundary polygons are cached in `localStorage`.
2. **Debouncing Map Events**: Map pan and zoom event updates are debounced before reloading posts to prevent excessive queries.
