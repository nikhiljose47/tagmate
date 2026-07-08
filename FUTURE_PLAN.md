# Tagmate Future Redesign Plan

## Summary

Tagmate should evolve from a social-feed-first app into a structured neighborhood operations workspace while keeping its local personality. The first release should focus on a serious desktop app shell, denser Feed and Map workflows, and lightweight Admin and Analytics surfaces powered by existing app data.

This v1 preserves existing route URLs and avoids new backend tables. The goal is to make Tagmate feel like a location intelligence console without taking on a full data-platform migration at the same time.

## Key Changes

- Move authenticated routes into a three-zone app shell: persistent left navigation, central workspace, and right context panel.
- Keep existing URLs such as `/feed`, `/hood`, `/messages`, `/profile`, `/post`, and `/posts/:id` to reduce routing and deep-link risk.
- Replace the floating global theme button with a top-right user menu that contains theme options, account/profile access, settings, and notification entry points.
- Add a top command/search bar for posts, neighborhoods, users, alerts, recent searches, and quick actions.
- Expand desktop navigation into workspace modules: Feed, Map, Neighborhoods, Messages, Reports, Analytics, Admin, and Profile.
- Keep mobile task-focused with bottom tabs for Home, Map, Post, Messages, and Profile, hiding heavier enterprise tools behind menus or drawers.
- Standardize major page headers with title, subtitle/context, primary action, and filter/action rows.
- Add stronger loading, empty, error, and permission states per module.

## Workspace Implementation

### Feed Workspace

- Convert the Feed from full-width social cards into a dense split view on desktop.
- Use the center/left area for a compact post list with category, severity/tag, hood, timestamp, author, counts, and selected state.
- Use the right context panel for selected post details, map metadata, comments/actions, save/report/delete/message controls, and optional AI summary.
- Preserve a familiar card-style browsing experience on small screens.

### Map Workspace

- Make the Map/Hood page the primary canvas for local operations.
- Move filters into a left drawer or panel: country mode, categories, layers, style, heatmap, boundary, and location search.
- Keep MapLibre in the center as the main interactive surface.
- Add a right selected-tag inspector with metadata, author, category, nearby context, and moderation/social actions.
- Add a bottom timeline/event drawer that summarizes visible posts by recency and category.

### Admin And Analytics

- Add routed Admin and Analytics feature modules as v1 scaffolds backed by existing services.
- Admin v1 should show reported or hidden posts, user activity, moderation actions, and deleted/hidden-content style queues where existing permissions allow.
- Analytics v1 should derive dashboard cards from current tag/social data: active posts by hood/category, alert volume, top contributors, engagement counts, and simple trend buckets.
- Keep advanced role-based access, moderation workflow tables, and warehouse-style analytics as future backend work.

## Interfaces And State

- Add a shared layout/workspace state service for selected item, context panel mode, command palette state, active filters, and responsive drawer state.
- Prefer lightweight view models over changing the core `Tag` model in v1:
  - `WorkspaceNavItem`
  - `CommandResult`
  - `PostListItem`
  - `ContextPanelState`
  - `AnalyticsSummary`
  - `ModerationQueueItem`
- Extend route constants and nav metadata with enterprise labels while preserving current route strings.
- Reuse existing `TagRepository`, `SocialInteractionsService`, notifications, report/hidden state, aggregate counts, and MapLibre behavior.
- Avoid introducing new backend tables in v1; any missing data should appear as clear empty, unavailable, or permission states.

## Test Plan

- Unit test shell visibility: login routes do not render the operations shell; authenticated routes render shell, nav, topbar, and workspace outlet.
- Unit test command/search filtering and quick-action routing.
- Unit test Feed selection, right-panel state, category filters, saved/hidden filtering, and mobile card fallback.
- Unit test Analytics summary calculations from mocked `Tag[]` data.
- Manually verify desktop, narrow desktop, tablet, and mobile layouts.
- Manually verify MapLibre still initializes, resizes correctly inside the new shell, and existing map controls still work.
- Manually verify empty, loading, error, and permission states for Feed, Map, Admin, Analytics, and Messages.
- Run:

```bash
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```

## Assumptions

- The first release is "Shell + Workspaces": meaningful enterprise layout and scaffolds, not a complete backend moderation or analytics platform.
- Existing URLs remain stable.
- Current design tokens remain the base visual system, with increased layout density and fewer floating controls.
- Admin and Analytics v1 can use currently available app data and show honest unavailable states where backend support is missing.
- Real role-based permissions, durable moderation queues, and deeper analytics schemas can be planned after the workspace redesign lands.
