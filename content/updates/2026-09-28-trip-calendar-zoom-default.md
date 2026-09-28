---
id: rel-2026-09-28-trip-calendar-zoom-default
version: v0.198.0
title: "A more compact calendar zoom"
date: 2026-09-28
published_at: 2026-09-28T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The trip calendar now opens at a more compact zoom that fits more of your trip on screen."
---

## Changes
- [x] [Improved] 🗓️ The trip calendar opens at a more compact zoom, so more days of a longer trip fit on screen next to the map while staying readable.
- [x] [Fixed] 🔎 A short trip that was saved very zoomed out now zooms back in to fill the calendar when you open it.
- [ ] [Internal] 📐 Auto-fit floor lowered from 0.6x to 0.4x; the vertical calendar reports its trip extent via `data-auto-fit-extent` so filler days no longer count as content. Regression tests added.
