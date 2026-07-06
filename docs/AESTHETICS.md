# Aesthetics & Visual System Documentation

Tagmate focuses on rich layouts, responsive overlays, dynamic category-driven UI aesthetics, and instant theme switching.

---

## 🎨 Theme Presets & Color Systems
Tagmate integrates **Tailwind CSS v4** layers with vanilla CSS/SCSS design variables. There are five curated theme options, configured to retain contrast and visual balance:

1. **Light Theme**: High-contrast, clean light layout.
2. **Dark Theme**: Dark charcoal backgrounds tailored for low-light environments.
3. **Midnight Theme**: OLED black style (`#000000`) for power efficiency and high contrast.
4. **Forest Theme**: Deep emerald-green shades mimicking parkland and community gardens.
5. **Sepia Theme**: Warm amber and brown paper shades for a reading-friendly, paper-like aesthetic.

---

## 🌟 Dynamic Category Gradients
Posts are categorized into distinct tag kinds. Each kind maps to a custom visual theme featuring smooth gradient headers:

| Tag Category | Color Theme | Visual Emoji | Gradient Range |
| --- | --- | --- | --- |
| `Alert` | Red / Orange | ⚠️ | `#ef4444` to `#f97316` |
| `Event` | Indigo / Violet | 📅 | `#6366f1` to `#8b5cf6` |
| `Sale` | Green / Emerald | 🏷️ | `#22c55e` to `#10b981` |
| `Food` | Orange / Amber | 🍔 | `#f97316` to `#f59e0b` |
| `Traffic` | Amber / Yellow | 🚗 | `#f59e0b` to `#eab308` |
| `Market` | Teal / Cyan | 🛍️ | `#14b8a6` to `#06b6d4` |
| `Question` | Sky / Blue | ❓ | `#38bdf8` to `#0284c7` |
| `Bulletin` | Violet / Indigo | 📌 | `#8b5cf6` to `#4f46e5` |

---

## ⏳ Live Expiration Countdowns
To prevent outdated alerts from crowding the map, posts have a natural expiration lifetime:
* Active posts display a live countdown label (e.g. `Expires in 42m`).
* Managed via an active Angular Signal timer updating every **15 seconds**.
* Automatically transitions the card element to an expired/dimmed visual state once the threshold is crossed, before removal.
