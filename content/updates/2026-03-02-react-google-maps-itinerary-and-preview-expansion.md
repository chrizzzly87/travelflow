---
id: rel-2026-03-02-react-google-maps-itinerary-and-preview-expansion
version: v0.78.0
title: "React Google Maps itinerary migration and trip preview expansion"
date: 2026-03-02
published_at: 2026-03-02T13:30:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Trip planner map rendering is now more stable, with clearer markers and expanded custom trip preview coverage across key surfaces."
---

## Changes
- [x] [Improved] 🗺️ Trip itinerary maps now load with more stable rendering behavior during planner interactions.
- [x] [Improved] 📍 City and transport markers now have clearer visual hierarchy so active stops and route icons are easier to read.
- [x] [Improved] 🧭 Trip preview maps on profile, trip manager, and admin surfaces now render more consistently with shared map styling.
- [x] [Improved] 🧱 Dark map route legs now use stronger light-edge contrast so paths stay visible against dark basemaps.
- [x] [Improved] 🎯 Clicking a map city pin now selects that stop, opens its details, and auto-scrolls to it in the active planner view.
- [x] [Fixed] 🧩 Single-city trip previews now render reliably instead of failing route-only preview assumptions.
- [ ] [Internal] 🛣️ Switched realistic route checks to the newer Google Routes API path with legacy fallback support.
- [ ] [Internal] 🧪 Added regression coverage for proxy-based trip preview URL generation and single-city preview behavior.
