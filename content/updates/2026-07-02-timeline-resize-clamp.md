---
id: rel-2026-07-02-timeline-resize-clamp
version: v0.138.0
title: "Timeline resize fix"
date: 2026-07-02
published_at: 2026-07-02T19:41:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Resizing a city stay on the timeline now stops cleanly at the neighboring stay."
---

## Changes
- [x] [Fixed] 📏 Dragging a city stay's left edge on the timeline no longer lets it overlap the neighboring stay.
- [ ] [Internal] Resize-left handler clamped against the first earlier city in array order instead of the adjacent one; extracted a pure `findPreviousCity` neighbor lookup (max end among earlier cities) into `utils/timelineNeighbors.ts` with regression tests.
