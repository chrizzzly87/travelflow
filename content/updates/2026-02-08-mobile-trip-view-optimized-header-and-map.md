---
id: rel-2026-02-08-mobile-trip-view-optimized-header-and-map
version: v0.15.0
title: "Mobile trip view header and map optimization"
date: 2026-02-08
published_at: 2026-02-08T18:00:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Trip view on mobile now prioritizes timeline readability with a simplified header, a details modal, and a map-first expand workflow."
---

## Changes
- [x] [Improved] 📱 Simplified the mobile trip header by hiding secondary meta/source text and moving extra details into a dedicated information modal.
- [x] [Improved] 📋 Added a mobile trip information modal with full title context, trip meta metrics, optional source link, destination info, and collapsible history access.
- [x] [Improved] 📱 Forced mobile trip view into a timeline-first layout with the map always below and a pinch-to-zoom timeline interaction.
- [x] [Improved] 📱 Replaced map layout toggles on mobile with an expand/shrink map control that opens a 70%-height bottom overlay.
- [x] [Improved] 📱 Updated the My Plans trigger to use a route icon and changed the plans drawer to slide in from the right.
- [ ] [Internal] 🧩 Added viewport-aware rendering paths in `TripView` and optional map-control flags in `ItineraryMap` to isolate mobile behavior without altering desktop defaults.
