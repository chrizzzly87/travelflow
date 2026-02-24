---
id: rel-2026-02-24-route-outline-visibility
version: v0.59.0
title: "Adaptive route outlines for better map readability"
date: 2026-02-24
published_at: 2026-02-24T19:40:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Trip map routes now render with adaptive outlines that preserve leg readability across map styles without degrading dashed fallback routes."
---

## Changes
- [x] [Improved] 🗺️ Trip map routes now use adaptive outline colors so legs stay visible on clean, dark, and satellite map styles.
- [x] [Fixed] 🚆 Dashed fallback route legs now keep their dashed visual language while still getting contrast support.
- [ ] [Internal] 🧪 Added regression coverage for style-aware outline color mapping and icon-only fallback outline behavior.
