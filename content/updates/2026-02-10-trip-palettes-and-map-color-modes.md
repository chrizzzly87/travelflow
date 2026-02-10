---
id: rel-2026-02-10-trip-palettes-map-color-modes
version: v0.48.0
title: "Trip palettes and map color modes"
date: 2026-02-10
published_at: 2026-02-10T21:35:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "City colors now support palettes, custom HEX/RGB values, trip-aware map coloring, and roundtrip-aware example previews."
---

## Changes
- [x] [New feature] 🎨 Upgraded the city color picker with palette stripes, active swatches, and manual HEX/RGB input (no transparency).
- [x] [New feature] 🧭 Added a map color mode switch (`Trip colors` or `Brand accent`) in the map style menu.
- [x] [Improved] 🗺️ Custom city colors now render across map routes, transport icons, timeline blocks, print view, and selected-city indicators.
- [x] [Improved] 🌸 Example trips now open with matching palette and map-style defaults, and homepage cards render palette-aware preview maps.
- [x] [Improved] 🔁 Example trips now support roundtrip metadata and homepage roundtrip badges, with looped routes keeping matching start/end city colors.
- [x] [Improved] 🛣️ Homepage static trip map previews now respect each template’s route mode, including realistic road routing.
- [x] [Fixed] 🌈 Homepage trip previews now render per-leg route colors from the trip palette instead of a single route color.
- [x] [Fixed] 🔎 City blocks now auto-pick high-contrast text colors for custom light/dark backgrounds to keep labels readable.
- [x] [Fixed] 📍 Map stop pins now auto-pick contrasting number text colors so stop indices remain readable across all pin colors.
- [x] [Fixed] 🎚️ Fixed map color mode state so `Brand accent` applies correctly when enabled.
- [x] [Improved] 🔐 Map color mode controls are now internal-only by default (visible in local/dev or with internal flag).
- [x] [Fixed] ⚫ Contrast-based labels now use pure black/white text for maximum readability on all custom and palette colors.
- [x] [Fixed] 🪪 City timeline cards now compute contrast text from the resolved city color for both preset and custom values.
- [x] [Improved] ❄️ Iceland Ring Road now closes the loop back to Reykjavik and uses a high-contrast aurora palette on dark maps.
- [x] [Improved] 🌌 Dark map styling now has stronger land/ocean contrast, and the Iceland example uses a brighter aurora-style palette.
- [x] [Fixed] 🔗 Example trip links now reliably apply map style defaults from trip data when loading.
- [x] [Improved] 🧭 Updated example map defaults so Atlantic Coast uses minimal, South Island Wilderness uses dark, and Andes & Amazon Explorer uses standard.
- [x] [Improved] 🔀 Reordered homepage examples to place Atlantic Coast Road Trip before Cherry Blossom Trail.
- [x] [Fixed] 🖼️ Regenerated homepage static map preview PNGs and bumped fallback cache version so updated styles (including NZ dark map) render immediately.
- [ ] [Internal] 🧱 Extended edge map preview and OG preview pipelines to accept style, route, and map-color-mode parameters.
