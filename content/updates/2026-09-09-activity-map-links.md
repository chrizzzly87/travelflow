---
id: rel-2026-09-09-activity-map-links
version: v0.165.0
title: "Open any activity in Google Maps or Apple Maps"
date: 2026-09-09
published_at: 2026-09-09T12:00:00Z
status: draft
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
