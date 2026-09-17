---
id: rel-2026-09-17-flight-arcs-on-trip-previews
version: v0.172.0
title: "Flights curve on trip preview cards, the way they do on the map"
date: 2026-09-17
published_at: 2026-09-17T07:20:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "A flight on a trip card now draws the same curve it draws on your planner map, instead of a straight line across the country."
---

## Changes
- [x] [Fixed] ✈️ A flight now curves on trip cards and example cards, exactly as it does on your planner map. Before, only the map knew it was a flight — the cards drew a straight line across the country.
- [x] [Fixed] 🖼️ The image shared when you send a trip link curves its flights too, so the link preview matches what the trip looks like.
- [x] [Improved] 🧭 A trip that mixes flights with road and rail now reads correctly at a glance: the flown legs arc, the driven ones follow the road.
- [ ] [Internal] 🔀 Preview URLs carry a `legModes` parameter (added to the CDN cache key and sent only when the trip has a flight), so the renderer can tell a flown leg from a driven one.
- [ ] [Internal] 🧮 `shared/flightRouteCurve.ts` is now the single source of the arc; the planner map, the client static-map builders and the edge renderers all derive it from there.
- [ ] [Internal] 💸 A plane leg no longer spends a Directions call that can only return nothing, and the Mapbox URL-cap fallback drops routed geometry before it drops flight arcs.
- [ ] [Internal] 🧪 Regression coverage for the arc on both providers, for the skipped Directions call, and for `legModes` staying absent on a flight-free trip.
