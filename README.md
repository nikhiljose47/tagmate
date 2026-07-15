# Tagmate

Tagmate is an Angular location-based posting app. The island map uses MapTiler SDK, MapTiler hosted map styles, GeoJSON sources, clustering, responsive overlays, and a gamified featured-marker layer for smooth desktop and mobile browsing.

## Documentation

More project notes live in `docs/`:

- `docs/MAPPING_AND_GEOSPATIAL.md` - map setup, boundaries, clustering, and caching.
- `docs/AI_CONCIERGE.md` - Chatmate AI behavior and map actions.
- `docs/GAMIFICATION.md` - quests, reputation, and contributor features.
- `docs/SOCIAL_SUITE.md` - messaging, comments, RSVPs, polls, and notifications.
- `docs/AESTHETICS.md` - visual themes and UI treatment.

## Versions Used

These are the versions currently installed in this workspace:

| Tool or package | Version |
| --------------- | ------- |
| Node.js         | 22.22.3 |
| npm             | 11.4.2  |
| Angular CLI     | 21.2.17 |
| Angular         | 21.2.17 |
| TypeScript      | 5.9.3   |
| RxJS            | 7.8.2   |
| MapTiler SDK    | 4.0.2   |
| MapLibre GL JS  | 5.24.0  |
| NgRx            | 21.1.1  |
| Supabase JS     | 2.110.0 |
| Bootstrap Icons | 1.13.1  |
| Tailwind CSS    | 4.3.1   |
| Wrangler        | 4.45.3  |

The declared dependency ranges are in `package.json`. The exact installed dependency tree is locked in `package-lock.json`.

## Install

Install dependencies from the project root:

```bash
npm install
```

On Windows PowerShell, you can also use:

```bash
npm.cmd install
```

## Environment Setup

Configure the Angular environment files in:

```text
src/app/environments/environment.ts
src/app/environments/environment.staging.ts
src/app/environments/environment.prod.ts
```

Required values:

```ts
export const environment = {
  production: false,
  mapTilerApiKey: 'YOUR_MAPTILER_API_KEY',
  supabaseUrl: 'YOUR_SUPABASE_URL',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
};
```

MapTiler styles are loaded through the SDK and style URLs such as:

```text
https://api.maptiler.com/maps/streets-v4/style.json?key=YOUR_MAPTILER_API_KEY
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

The island map page is available at:

```text
http://localhost:4200/island
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

## Tests

Run unit tests:

```bash
npm test
```

For a single headless run:

```bash
npm test -- --watch=false --browsers=ChromeHeadlessNoGpu
```

## Cloudflare Worker Preview

This project includes Wrangler configuration for the built app.

Preview locally:

```bash
npm run start
```

Deploy:

```bash
npm run deploy
```

## Island Map

The main island map files are:

```text
src/app/features/hood-island/pages/hood-island/hood-island.ts
src/app/features/hood-island/pages/hood-island/hood-island.html
src/app/features/hood-island/pages/hood-island/hood-island.scss
```

Current map behavior:

- MapTiler SDK creates the map with `import * as maptilersdk from '@maptiler/sdk'`.
- The default island center is Marathahalli, Bengaluru: `[77.7011, 12.9569]`.
- The map camera fits the active island boundary and then keeps panning constrained nearby.
- A single clustered GeoJSON source renders the normal city markers.
- Dummy marker data is generated locally for alerts, connects, and openings.
- Three featured animated HTML markers are shown at a time.
- Featured markers rotate every 15 seconds from an init-time shuffled queue and pause while hovered.
- Marker randomness happens only when the island page initializes, such as after a refresh.
- Clicking a normal marker promotes it into the featured set.
- Map resize handling keeps the layout stable across desktop and mobile screens.

## Responsive Notes

The island map layout is tuned for desktop and mobile:

- Map height uses modern viewport units with mobile fallbacks.
- Controls wrap or stack on narrow screens.
- Popups have constrained widths and responsive media sizing.
- Marker rendering uses WebGL layers for normal markers instead of many DOM nodes.
- Map resize calls run after container changes so the map canvas does not load with stale dimensions.

## Useful Commands

```bash
npm install
npx ng serve
npm run build
npm test -- --watch=false --browsers=ChromeHeadlessNoGpu
npm run start
npm run deploy
```
