---
id: rel-2026-08-19-country-route-map-previews
version: v0.160.0
title: "Featured routes now show their map"
date: 2026-08-19
published_at: 2026-08-19T12:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Every featured route on a country guide now shows a real map tracing its stops in travel order."
---

## Changes
- [x] [New feature] 🛤️ Featured routes on country guides now show a real map that traces every stop in travel order, so you can see the shape of a trip before opening it.
- [x] [New feature] 🇪🇸 Added an Andalusian rail route for Spain: Madrid, Seville, Granada and Málaga without a rental car.
- [x] [Improved] 🎨 Route maps use the same colours as the city lanes under them, so each stop is easy to follow from the map to the timeline.
- [ ] [Internal] 🗺️ Added `pnpm maps:routes:generate` with `--dry-run`, `--route` and `--force`, rendering one committed PNG per curated route and writing `mapImagePath` back into the route document.
- [ ] [Internal] 🧩 Extracted the Static Maps URL builder into `scripts/lib/staticMapPreview.ts` so homepage trip cards and route cards share style tokens, dimensions and marker treatment.
- [ ] [Internal] 🚧 Routes with an unresolved stop are skipped by the generator instead of drawing a wrong line; `pnpm routes:validate` now fails when a declared map image is not committed.
