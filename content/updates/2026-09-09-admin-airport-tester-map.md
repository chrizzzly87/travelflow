---
id: rel-2026-09-09-admin-airport-tester-map
version: v0.164.0
title: "The airport tester map works again"
date: 2026-09-09
published_at: 2026-09-09T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The nearest-airport preview now draws on whichever map the team runs, and every airport pill opens its full record."
---

## Changes
- [x] [Fixed] 🗺️ The nearest-airport preview draws again instead of sitting on an empty grey panel.
- [x] [New feature] 📍 Tap any airport pill on the preview to see its full record — codes, city, service tier, scheduled service, timezone, distance and coordinates.
- [x] [Improved] ⌨️ Airport pills can be reached and opened from the keyboard, and the detail card closes with Escape.
- [ ] [Internal] Extracted the tester map into `components/admin/AdminAirportTesterMap.tsx` and moved point/pill/detail building into a pure `airportTesterMapModel` module.
- [ ] [Internal] The tester now resolves its renderer from `MapRuntimeResolution.effectiveSelection.renderer`, mounting a standalone Mapbox GL map when Mapbox is active and falling back to Google when no Mapbox token shipped.
- [ ] [Internal] Mapbox readiness keys off the map instance plus `styledata`/`isStyleLoaded` rather than `load`, so a tester initialised in a background tab still renders its markers.
- [ ] [Internal] Added Vitest coverage for renderer resolution, point/pill/detail construction, label escaping, and the pill-click detail flow.
