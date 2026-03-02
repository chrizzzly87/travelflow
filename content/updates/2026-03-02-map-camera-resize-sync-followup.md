---
id: rel-2026-03-02-map-camera-resize-sync-followup
version: v0.78.0
title: "Map camera sync for docked and floating resize transitions"
date: 2026-03-02
published_at: 2026-03-02T10:15:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Planner map camera behavior is now kept consistent when switching between docked and floating sizes."
---

## Changes
- [x] [Improved] 🧭 Switching between docked and floating map modes now keeps the camera stable after size transitions.
- [x] [Improved] 🔎 Floating map size and orientation changes now preserve zoom level for a more consistent view.
- [x] [Improved] 🎯 Automatic resize centering now runs only when no city is actively focused and the map has not been manually moved.
- [ ] [Internal] 🧪 Added regression coverage for resize camera strategy and itinerary-center resolution.
