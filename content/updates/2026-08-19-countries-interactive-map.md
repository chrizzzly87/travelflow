---
id: rel-2026-08-19-countries-interactive-map
version: v0.161.0
title: "An interactive world map on the countries explorer"
date: 2026-08-19
published_at: 2026-08-19T12:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Hover or click any country on a new world map, and sort the whole list by how far away it is from you."
---

## Changes
- [x] [New feature] 🗺️ A world map now sits above the country list. Hover a country to see its name, region and what the month you picked looks like there, then click to open its guide.
- [x] [New feature] 🧭 A new "Nearest to me" sort puts the countries closest to you at the top of the list.
- [x] [Improved] 🎨 The map follows your search and filters: countries that no longer match fade back, and the ones we have a guide for stand out from the ones we do not.
- [x] [Improved] 🔍 Tiny countries like Singapore and the Maldives get their own dot on the map, so nothing in the list is missing from the picture.
- [x] [Improved] ⌨️ You can walk across the map with the arrow keys and open a guide with Enter, and every country reads out its name, region and season.
- [x] [Improved] 🤝 Clicking a country we have not covered yet says so plainly instead of doing nothing.
- [x] [Improved] 🙋 Distance sorting shows you which city it thinks you are near, says the guess comes from your internet connection rather than your device, and lets you wave it away in one click. Distances are straight-line, and the page says so.
- [x] [Fixed] 🧮 When we cannot work out where you are, the list stays in its usual order and tells you why, instead of quietly showing a wrong one.
- [ ] [Internal] 🧱 Added a build-time generator turning Natural Earth 110m topojson into pre-projected SVG paths plus a representative anchor per country, reusing the climate-normals anchor where one exists.
- [ ] [Internal] 📦 Rendered the map as inline SVG in a lazily imported chunk (~42 kB gzip) rather than pulling `mapbox-gl` into a view that never pans or zooms.
- [ ] [Internal] 🧭 Added `countryDistanceService` (haversine, `undefined` for unplaceable countries), `countryOriginService` (an explicit idle/loading/ready/dismissed/unavailable projection of the existing runtime-location edge lookup) and `countryMapPresentation` (pure tone/marker/keyboard-order model).
- [ ] [Internal] 🔌 The map and the grid both derive from the existing explorer reducer, so no parallel store was introduced and `?sort=distance` round-trips through the URL.
- [ ] [Internal] 🛡️ The location lookup is opt-in and only fires once the distance sort is requested; the session dismissal flag is registered in the cookie registry.
- [ ] [Internal] 📊 Instrumented `inspirations__country_map`, `inspirations__country_map--no_guide`, `inspirations__country_sort--origin_dismiss` and `inspirations__country_sort--origin_restore`.
- [ ] [Internal] ✅ Added 73 tests covering the haversine maths (equator, antimeridian, pole and antipodal cases), map/grid agreement, the origin status machine and rendered hover/click/keyboard behaviour.
