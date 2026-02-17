---
id: rel-2026-02-13-create-trip-reliability-and-classic-default
version: v0.45.0
title: "Create-trip reliability fix and Classic Card default rollout"
date: 2026-02-13
published_at: 2026-02-15T19:16:28Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Create Trip now recovers from first-load failures more reliably, with Classic Card as default and a smoother generation flow across mobile and localized experiences."
---

## Changes
- [x] [Fixed] 🧩 Create Trip now auto-recovers from stale first-load assets, so users are less likely to hit a broken screen.
- [x] [Improved] 🧭 Classic Card became the default planner flow with clearer required steps for destinations and dates.
- [x] [Fixed] 🔁 Inspiration links now prefill the planner reliably again, so users can start faster without re-entering details.
- [x] [Improved] 📱 Mobile trip snapshot controls are easier to read and use, with better spacing and clearer actions.
- [x] [Improved] 🌍 Create Trip language quality improved across supported locales, including better translation consistency.
- [x] [Improved] 🚀 Trip generation now transitions more smoothly into the trip view with clearer progress feedback while loading.
- [x] [Improved] 🧪 The create-trip labs area now offers easier access to multiple planner concept variants for quick comparison.
- [x] [Fixed] 🗓️ Calendar and weekday labeling fixes improved date clarity across timezones and locales.
- [ ] [Internal] 📈 Added create-trip interaction instrumentation and chunk-recovery observability updates.
- [ ] [Internal] 📄 Added prompt-mapping and DB-tracking strategy docs to define no-effect fields, effective defaults, and phased post-auth telemetry design.
- [ ] [Internal] 🧹 Removed local absolute filesystem path references from markdown docs in favor of repository-relative paths.
