---
id: rel-2026-02-14-trip-timeline-transfer-connectors
version: v0.46.0
title: "Timeline transfer lane compaction and connector upgrade"
date: 2026-02-14
published_at: 2026-02-16T06:24:40Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Trip timeline now uses denser transfer lanes, clearer transfer copy, and cleaner connector links between cities."
---

## Changes
- [x] [Improved] 🧭 The horizontal timeline now uses a denser city/transfer layout to free vertical space and keep routes easier to scan.
- [x] [Improved] 🔁 Planner timeline labels and helper copy now use "Transfer" where travel-between-cities actions are shown.
- [x] [Improved] 🔗 Transfer pills now use dedicated city-to-pill connector lines, with dashed styling when transfer routing is missing or failed.
- [x] [Improved] 🏙️ City stay cards now use a cleaner compact layout and show full city/country + stay details via the delayed desktop tooltip.
- [x] [Improved] 🔎 Transfer pills now adapt by zoom level (compact icon-only/N-A at very small zoom, readable icon+label at regular zoom, and duration metadata when space allows).
- [x] [Fixed] 🛡️ Example and preview trips now fail gracefully with clearer fallback behavior instead of throwing app-blocking errors.
- [ ] [Internal] 🧱 Added shared route-status typing and timeline prop plumbing so connector styling can react to map routing outcomes.
