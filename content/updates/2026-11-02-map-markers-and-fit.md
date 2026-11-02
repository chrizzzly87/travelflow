---
id: rel-2026-11-02-map-markers-and-fit
version: v0.219.0
title: "Map markers stay put and fit to itinerary works again"
date: 2026-11-02
published_at: 2026-11-02T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "City names and markers no longer disappear while you zoom the trip map, and the fit to itinerary button frames your whole trip again."
---

## Changes
- [x] [Fixed] 🎯 The fit to itinerary button frames your whole trip again on the map.
- [x] [Fixed] 📍 Trip markers no longer vanish while you zoom the map.
- [x] [Improved] 🏷️ Every city name stays on the map, even where cities sit close together.
- [ ] [Internal] 🧭 The Mapbox camera no longer passes unset fit options, which made Mapbox skip the fit.
- [ ] [Internal] 🔁 A marker redraw that lands while Mapbox loads tiles now retries once the map goes idle.
- [ ] [Internal] 🧹 Removed the crowded-label hiding from the Mapbox city label layout.
