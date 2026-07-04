# Tagmate AI Agent Workspace Guidelines

You are acting as an AI coding agent on the Tagmate codebase. To maintain coding standards, feature alignment, and testing integrity, you MUST follow these guidelines.

---

## 1. Documentation Maintenance (CRITICAL)

- **Update FEATURES.md Always**: Every time you add a new feature, modify an existing one, change verification procedures, or implement items from the proposed roadmap, you **must** update the [FEATURES.md](file:///d:/Coding/tagmate/FEATURES.md) file in the project root. Keep the features list, upcoming roadmap, and verification checklists synchronized and current.
- **Instruct Successors**: Ensure any instructions, skills, or guidelines loaded into your successor agents reinforce keeping the documentation up-to-date.

---

## 2. Technical Stack & Styling

- **Framework**: Angular 21+ using Signals and Zoneless Change Detection (`provideZonelessChangeDetection()`).
- **Styling**: Tailwind CSS v4 layered via `@theme` alongside vanilla CSS/SCSS variables. Modulate styles to preserve background and border contrast across all themes:
  - `light`
  - `dark`
  - `midnight` (OLED black)
  - `forest` (emerald-green theme)
  - `sepia` (amber-brown theme)
- **Geospatial**: MapLibre GL JS rendering MapTiler styles, GeoJSON features, and dynamic OpenStreetMap Nominatim boundary polygons.

---

## 3. Verification & Testing Routine

Before submitting or completing a task, you must:
1. **Run Unit Tests**: Check for compile-time errors and run headless tests:
   ```bash
   npm test -- --watch=false --browsers=ChromeHeadless
   ```
2. **Manual Check**: Go through the verification checklist in [FEATURES.md](file:///d:/Coding/tagmate/FEATURES.md) to inspect UI flows, tab views, theme compatibility, and local storage state consistency.
