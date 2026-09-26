---
id: rel-2026-09-26-trip-stale-chunk-recovery
version: v0.192.0
title: "Trips open reliably after an update, and a readable view-only card"
date: 2026-09-26
published_at: 2026-09-26T12:06:45Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "A trip left open across an update no longer fails to load, and the Copy trip button on shared view-only trips is readable in dark mode."
---

## Changes
- [x] [Fixed] 🔄 Opening a trip in a tab that was left open across an update no longer fails with a loading error. The page now refreshes itself once and opens the trip on the new version.
- [x] [Fixed] 📋 The "Copy trip" button on the view-only card of a shared trip is readable in dark mode, and looks the same as the one in the top bar.
- [ ] [Internal] 🧩 The trip, shared-trip and example-trip routes now load the planner through the same stale-chunk recovery as every other lazy route.
- [ ] [Internal] 🚫 Missing build assets now return a real 404 instead of the app shell as 200 HTML with a one-year immutable cache header, which the browser and service worker stored under a .js URL.
- [ ] [Internal] 🧷 Both "Copy trip" actions now share one component, with click tracking per surface; the AI launcher, example banner and view-only card all take their corner position from one shared module.
