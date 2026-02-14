---
id: rel-2026-02-14-trip-timeline-transfer-connectors
version: v0.55.0
title: "Timeline transfer lane compaction and connector upgrade"
date: 2026-02-14
published_at: 2026-02-14T13:20:45Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Trip timeline now uses denser transfer lanes, clearer transfer copy, and cleaner connector links between cities."
---

## Changes
- [x] [Improved] 🧭 The horizontal timeline now uses a denser city/transfer layout to free vertical space and keep routes easier to scan.
- [x] [Improved] 🔁 Planner timeline labels and helper copy now use "Transfer" where travel-between-cities actions are shown.
- [x] [Improved] 🔗 Transfer pills now use dedicated city-to-pill connector lines, with dashed styling when transfer routing is missing or failed.
- [x] [Improved] 🏙️ City stay cards now show correct day/night formatting (for example, “3 Days / 2 Nights”) and expose full city + country + stay length in a desktop hover tooltip.
- [ ] [Internal] 🧱 Added shared route-status typing and timeline prop plumbing so connector styling can react to map routing outcomes.
