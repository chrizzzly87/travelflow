---
id: rel-2026-10-31-itinerary-map-modules
version: v0.212.0
title: "Itinerary map helpers in their own modules"
date: 2026-10-31
published_at: 2026-10-31T18:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The itinerary map's pure helpers moved out of the map component into small, tested modules, with no change to how the map behaves."
---

## Changes
- [ ] [Internal] 🧩 Moved the itinerary map's route cache, marker sizing tiers, marker HTML, route-attempt rules and Mapbox route layer styling out of the map component into their own modules, unchanged.
- [ ] [Internal] 🗑️ Removed the hand-maintained copy of those helpers that only the tests ran, so the tests now exercise the code the map actually uses.
- [ ] [Internal] 🧪 Added unit tests for route cache expiry and hydration, the route-attempt rules, marker HTML escaping and the marker tier maths.
