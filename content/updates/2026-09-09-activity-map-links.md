---
id: rel-2026-09-09-activity-map-links
version: v0.174.0
title: "Open any activity in Google Maps or Apple Maps"
date: 2026-09-17
published_at: 2026-09-17T09:50:44Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Tap an activity on the map to see what it is and open it straight in Google Maps or Apple Maps — on a phone the navigation app launches directly."
---

## Changes
- [x] [New feature] 📍 Tap an activity pin on the map to see what it is, where it is and open it in Google Maps or Apple Maps.
- [x] [New feature] 🧭 On a phone those buttons hand straight over to the installed navigation app, so you can start walking without retyping the name.
- [x] [Improved] 🏨 Activity, city and accommodation details now carry the same two buttons, so anything with an address is one tap from directions.
- [x] [Improved] 🎯 Activities now remember exactly where they are the first time you open them, so their pin sits on the venue instead of the middle of the city.
- [ ] [Internal] Added `services/mapDeepLinkService.ts` for universal Google and Apple Maps links, with a search fallback when no position is stored.
- [ ] [Internal] Added `services/activityLocationResolver.ts`, keyed on a persisted `coordinatesQuery` so each distinct place is geocoded once and a hand-picked position is never overwritten.
- [ ] [Internal] Added the anchored pin callout and its marker-tracking hook under `components/maps/`.
- [ ] [Internal] 🔗 Reconciled with the idea-card directions work that landed in v0.173.0 while this sat open. Two modules had grown their own coordinate validation, lat/lng formatting and "combine a name and an address without repeating" rule; they now share `shared/mapPlaceLinks.ts`. The two *builders* stay separate on purpose — viewing a place wants universal https links that cannot dead-end, getting directions wants `geo:` on Android so the system's own app chooser appears.
- [ ] [Internal] 🧭 The shared dedupe rule drops a qualifier only when the place already *ends* with it, and prefers the qualifier only when the qualifier is the fuller form. A plain "contains" test — which is what a first pass at merging the two rules produced — dropped the city from "Old Taipei Temple and Street-Food Quest, Taipei", leaving a search for an invented name. Found on the Deploy Preview, not in the unit tests, and now covered by both.
- [ ] [Internal] 📐 Map links now reject an out-of-range coordinate pair, not just a non-finite one. A swapped lat/lng is still two finite numbers, and it used to produce a confident link to the wrong hemisphere; it now falls back to a text search.
- [ ] [Internal] 🔀 Merged `main` and kept both sides of the one real conflict: activity markers stay on by default (the zoom gate keeps them out of a country-wide view) alongside this branch's popup state.
