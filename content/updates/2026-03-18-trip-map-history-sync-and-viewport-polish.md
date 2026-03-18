---
id: rel-2026-03-18-trip-map-history-sync-and-viewport-polish
version: v0.0.0
title: "Trip map interactions stay in sync and fit the route more gracefully"
date: 2026-03-18
published_at: 2026-03-18T10:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Stabilizes planner map changes so style switches, zooming, and new city edits stop snapping back to stale state, while the map viewport gains roomier route framing and clearer labels."
---

## Changes
- [x] [Fixed] 🗺️ Trip map changes now keep their latest state more reliably, so map style switches, zooming, and newly added cities are less likely to snap back or reload older planner data.
- [x] [Improved] 📍 Route fitting now leaves a larger safe zone around the itinerary, activity markers appear earlier while zooming, and city labels stay easier to read on top of the map.
- [ ] [Internal] 🧪 Added regression coverage for versioned trip history snapshots and the new route-fit padding so route loads can immediately resolve the latest local planner state.
