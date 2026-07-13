# Quality evaluation suite

The automated quality suite registers **125 independent Jasmine tests** in
`src/app/core/services/quality-evaluation.spec.ts`. It focuses on the highest
risk client-side paths that can be evaluated deterministically in CI:

| Area | Cases | What is checked |
| --- | ---: | --- |
| Nominatim bounding boxes | 32 | Valid numeric conversion and rejection of malformed input |
| Rectangle fallback geometry | 24 | Coordinate order, closure, and valid fallback rings |
| Boundary simplification | 40 | Closed polygons, multipolygon preservation, and reduced vertex work |
| Boundary API mapping | 29 | Polygon, multipolygon, URL encoding, errors, and fallback behavior |

Run the focused suite:

```powershell
npm.cmd run test:quality
```

Run the full browser test suite in CI mode:

```powershell
npm.cmd run test:ci
```

## Manual and end-to-end follow-up matrix

Browser unit tests cannot verify Supabase policies, actual mobile frame rates,
or connection recovery on their own. Before a release, run these scenarios in
staging as well:

- Pan, zoom, and switch map styles with dense neighborhood boundaries on a
  low-end Android device; inspect WebGL frame rate and memory use.
- Toggle airplane mode during a comment, RSVP, direct message, post edit, and
  post deletion; confirm the intended user-facing failure behavior.
- Send messages to a muted and an unmuted thread, then mark each thread read;
  confirm unread counts remain correct after reconnect and refresh.
- Run Supabase RLS policy tests as authenticated owner, non-owner, admin, and
  anonymous users for every mutable social table.
- Exercise Nominatim errors (429, 500, invalid JSON, empty result, geometry
  without a bounding box) and check that the map remains usable.
- Load a cache containing more than 50 boundary records and verify eviction
  preserves the most recently added entry.
