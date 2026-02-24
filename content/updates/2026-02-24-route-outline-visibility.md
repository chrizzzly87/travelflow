---
id: rel-2026-02-24-route-outline-visibility
version: v0.58.0
title: "Adaptive route outlines for better map readability"
date: 2026-02-24
published_at: 2026-02-24T19:35:35Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Trip map routes now render with dual-contrast outlines and thicker lines so leg paths stay readable across all map backgrounds."
---

## Changes
- [x] [Improved] 🗺️ Trip map routes now use a dual-contrast border (outer light + inner dark) so legs stay visible on clean, dark, and satellite map styles.
- [x] [Improved] 📏 Route strokes are now slightly thicker with a wider outside border to improve leg clarity at a glance.
- [x] [Fixed] 🚆 Dashed fallback route legs now keep their dashed visual language while still getting contrast support.
- [ ] [Internal] 🧪 Added regression coverage for dual-outline color mapping, thickness layering, and icon-only fallback outline behavior.
