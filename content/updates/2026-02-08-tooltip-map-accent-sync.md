---
id: rel-2026-02-08-tooltip-map-accent-sync
version: v0.11.0
title: "Trip tooltip map now follows accent tokens"
date: 2026-02-08
published_at: 2026-02-08T14:00:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "My Trips tooltip map previews now inherit the active accent color token instead of using hardcoded purple map styling."
---

## Changes
- [x] [Fixed] 🗺️ Updated the My Trips tooltip Google Static Map route and markers to use global accent token colors.
- [x] [Improved] 🎨 Added runtime CSS-token color resolution for tooltip map styling so future accent changes propagate automatically.
- [ ] [Internal] 🧩 Added CSS-color normalization helpers for token-to-hex conversion in external map URL parameters.
