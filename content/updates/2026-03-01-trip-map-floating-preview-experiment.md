---
id: rel-2026-03-01-trip-map-floating-preview-experiment
version: v0.64.0
title: "Trip page floating map preview experiment"
date: 2026-03-01
published_at: 2026-03-01T16:10:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Trip planner now includes an experimental map minimize mode with a draggable floating preview while the calendar expands to full workspace."
---

## Changes
- [x] [New feature] 🗺️ Trip planning now includes a map minimize control that can switch the map into a floating preview and restore it back to the main planner layout.
- [x] [Improved] 🪟 The minimized map now appears as a draggable floating card with a tall 2:3 preview shape, refined rounded corners, a reinforced top frame drag handle, springy snap motion, a strong white frame, and soft depth shadow.
- [x] [Improved] 📅 When the map is minimized, the calendar workspace now expands to use the full planner area and triggers an automatic timeline fit for easier editing.
- [ ] [Internal] 📊 Map preview minimize, maximize, and reposition interactions now emit dedicated trip-view analytics events.
- [ ] [Internal] ✅ Added regression coverage for floating map dock mode behavior and resize auto-fit triggers.
