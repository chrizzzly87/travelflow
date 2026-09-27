---
id: rel-2026-09-27-trip-calendar-auto-zoom
version: v0.194.0
title: "Readable calendar auto-zoom"
date: 2026-09-27
published_at: 2026-09-27T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The trip calendar no longer auto-zooms so far out that days become unreadable."
---

## Changes
- [x] [Improved] 🔍 The trip calendar keeps days readable when it zooms to fit your trip, so long trips scroll instead of shrinking to a sliver next to the map.
- [x] [Fixed] 📏 Auto-zoom no longer picks a level that spills just past the edge of the calendar.
- [ ] [Internal] 🧮 Simplified the auto-fit zoom resolution to "largest fitting preset, floored at 0.6x" and added regression tests.
