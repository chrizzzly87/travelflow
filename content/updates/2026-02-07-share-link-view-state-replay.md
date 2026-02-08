---
id: rel-2026-02-07-share-link-view-state-replay
version: v0.6.0
title: "Share link persistence and view-state replay"
date: 2026-02-07
published_at: 2026-02-07T20:00:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Sharing now keeps your generated links handy and opens shared trips with the same planner layout and map settings you shared."
---

## Changes
- [x] [Improved] ✨ Kept generated share links visible in the share popup per mode and added one-click copy for reuse.
- [x] [Improved] ✨ Added planner UI state to share URLs (layout, map style, route mode, city names, zoom, and panel sizing) so recipients see the same setup.
- [x] [Fixed] 🐛 Applied shared-link URL view overrides on load to replay the sharer’s visual configuration reliably.
- [ ] [Internal] 🧰 Added utility helpers for serializing and merging view settings from query parameters.
