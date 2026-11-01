---
id: rel-2026-11-01-standalone-mapbox
version: v0.214.0
title: "Trip maps keep working without Google Maps"
date: 2026-11-01
published_at: 2026-11-01T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Trip maps run on Mapbox on their own, so the map, city search and routes stay available while Google Maps is unavailable."
---

## Changes
- [x] [Improved] 🗺️ Trip maps keep working on Mapbox while Google Maps is unavailable.
- [x] [Improved] 🔎 Adding a city still finds places, such as Kapstadt, when Google search is off.
- [x] [Improved] 📏 Routes between stops show as straight lines on the map until driving directions are available again.
- [x] [Improved] ⏸️ Searching for activities and hotels on the map tells you when it is paused instead of loading forever.
- [ ] [Internal] 🎛️ The admin map settings now describe each preset and show which map keys are configured.
- [ ] [Internal] 🔄 Switching the map preset in the admin settings applies without a page reload.
- [ ] [Internal] 🚫 Under the Mapbox preset the Google Maps script is never loaded and no Google request is made.
- [ ] [Internal] ⏱️ A Google map that does not start within the timeout now falls back instead of waiting indefinitely.
