---
id: rel-2026-08-18-country-route-recommendations
version: v0.160.0
title: "Featured routes on every country guide"
date: 2026-08-18
published_at: 2026-08-18T12:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Country guides now feature ready-made routes you can open in the planner with every stop already in order."
---

## Changes
- [x] [New feature] 🧭 Country guides now show up to three ready-made routes, with duration, stops and the months they work best.
- [x] [New feature] 🖱️ Picking a route opens the planner with the whole city list already filled in, in travel order.
- [x] [Improved] 🗺️ Route cards use the same look as the example trips on the homepage, so a suggestion reads like a trip someone already planned.
- [x] [Improved] 🌍 Route names and descriptions are translated into German, Spanish, French, Italian and Portuguese.
- [ ] [Internal] 🧱 Added a curated country route schema, data file and lookup service, documented in `docs/COUNTRY_ROUTE_RECOMMENDATIONS.md`.
- [ ] [Internal] ✅ Added a build-time validator covering stop resolution, unique ids, the three-routes-per-country cap, month ranges and duration consistency.
- [ ] [Internal] 🔗 Extended the trip prefill contract with an optional ordered `cityList`, mirrored into the legacy comma-separated field for backward compatibility.
- [ ] [Internal] 📊 Instrumented route card clicks as `inspirations__country_route`.
