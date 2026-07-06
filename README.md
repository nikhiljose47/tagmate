# Tagmate

Tagmate is an Angular 20 location-based posting app. The hood map is rendered with MapLibre GL JS, MapTiler hosted styles, GeoJSON sources, and built-in clustering for smooth neighbourhood-level post browsing.

## 📖 Subsystem Documentation

Detailed architectural and feature documentation guides can be found in the [docs/](file:///d:/Coding/Web/tagmate/docs/) directory:
* [Mapping & Geospatial](file:///d:/Coding/Web/tagmate/docs/MAPPING_AND_GEOSPATIAL.md) - MapLibre configuration, OSM Nominatim boundaries, clustering, and caching.
* [Neighborhood AI Concierge (Chatmate AI)](file:///d:/Coding/Web/tagmate/docs/AI_CONCIERGE.md) - Glassmorphic chatbot panel, real-time context parsing, synonym mapping, map actions.
* [Gamification & Reputation](file:///d:/Coding/Web/tagmate/docs/GAMIFICATION.md) - Quests checklist, contributor leaderboards, Supabase metadata synchronization.
* [Social Interaction Suite](file:///d:/Coding/Web/tagmate/docs/SOCIAL_SUITE.md) - Direct messaging, real-time chatrooms, comments, event RSVPs, polls, notifications.
* [Aesthetics & Visual System](file:///d:/Coding/Web/tagmate/docs/AESTHETICS.md) - Custom themes, category-driven gradients, and live expiration countdowns.

## Versions Used


These are the versions currently used in this workspace:

| Tool or package | Version |
| --- | --- |
| Node.js | 22.22.3 |
| npm | 10.9.8 |
| Angular CLI | 20.3.8 |
| Angular | 20.3.9 |
| TypeScript | 5.9.3 |
| RxJS | 7.8.2 |
| MapLibre GL JS | 5.24.0 |
| Bootstrap | 5.3.8 |
| Wrangler | 4.45.3 |

The declared dependency ranges live in `package.json`; the exact installed tree is locked in `package-lock.json`.

## Install

Install dependencies from the project root:

```bash
npm install
```

On Windows PowerShell, if script execution blocks `npm`, use:

```bash
npm.cmd install
```

## Required Setup

Configure the Angular environment in:

```text
src/app/environments/environment.prod.ts
```

Required values:

```ts
export const environment = {
  mapTilerApiKey: 'YOUR_MAPTILER_API_KEY',
  firebase: {
    apiKey: '...',
    authDomain: '...',
    databaseURL: '...',
    projectId: '...',
    storageBucket: '...',
    messagingSenderId: '...',
    appId: '...',
    measurementId: '...',
  },
};
```

MapTiler is used for the MapLibre style URL:

```ts
https://api.maptiler.com/maps/streets-v4/style.json?key=...
```

## Development

Run the Angular dev server:

```bash
npx ng serve
```

Open:

```text
http://localhost:4200/
```

You can also run the configured watch build:

```bash
npm run watch
```

## Build

Create a production build:

```bash
npm run build
```

The output is written to:

```text
dist/
```

## Cloudflare Worker Preview

This project includes Wrangler configuration for the SSR build.

```bash
npm run start
```

That command builds the app and starts `wrangler dev`.

Deploy:

```bash
npm run deploy
```

## Tests

Run unit tests:

```bash
npm test
```

For a single headless run:

```bash
npm test -- --watch=false --browsers=ChromeHeadless
```

If ChromeHeadless fails on Windows because the GPU process cannot start, run tests in a regular Chrome browser or configure a no-GPU custom launcher in Karma.

## Map Feature Notes

The main map component is:

```text
src/app/components/tagmate/tagmate.ts
```

Current map behavior:

- MapLibre GL JS renders the map using a MapTiler hosted style.
- Posts from `src/app/data/tags.json` are converted to a small GeoJSON `FeatureCollection<Point>`.
- One clustered GeoJSON source is used for post markers.
- Clusters and individual posts are rendered with MapLibre WebGL layers.
- Cluster clicks use `getClusterExpansionZoom()`.
- Hood boundaries are loaded as GeoJSON Polygon or MultiPolygon data.
- The selected create-post location uses one temporary draggable marker.
- Map move events are debounced before visible posts are refreshed.

Default map zoom is `12`, matching the active zoom button on page load.

## Responsive Layout

The map shell is responsive for desktop and mobile:

- `100dvh` based map height with mobile fallbacks.
- Overlays are constrained and wrap on small screens.
- Search controls stack on narrow phones.
- `ResizeObserver` calls `map.resize()` after container changes.

## Useful Commands

```bash
npm install
npx ng serve
npm run build
npm test
npm run start
npm run deploy
```
