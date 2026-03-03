---
id: rel-2026-03-03-zero-results-route-availability-followup
version: v0.83.0
title: "Trip calendar exports and adaptive map marker controls"
date: 2026-03-03
published_at: 2026-03-03T16:45:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Added one-click trip calendar exports and upgraded planner/blog maps with adaptive marker behavior, cleaner controls, and stronger viewport stability."
---

## Changes
- [x] [New feature] 📅 Added one-click calendar downloads for single activities and full-trip exports, including activities, city stays, and everything in one file from details, trip info, and print view.
- [x] [New feature] 🧾 Calendar downloads now include clearer trip context with app attribution and direct links back to the trip page for easier reopen/share later.
- [x] [New feature] 🗺️ Activity markers now match activity-type chip colors/icons, support direct map click selection, show hover tooltips, and stay hidden by default until explicitly enabled.
- [x] [Improved] 📍 The Husum blog’s interactive map now uses in-app markers with softer accent styling, a cleaner left-side category accordion, and a full-height right-side map panel.
- [x] [Improved] 🧭 Map markers now auto-adapt by map size/zoom/route density, keep default city pins more prominent at higher zoom levels, and shift to compact or ultra-micro layouts only when space is truly constrained.
- [x] [Improved] 🎯 Planner map camera behavior now avoids unwanted jumps, preserves user zoom state during marker/filter changes, and keeps selection focus + resize-fit behavior stable across docked and floating layouts.
- [ ] [Internal] 🧱 Introduced a shared calendar file generator so all exports consistently include app attribution and canonical trip links.
- [ ] [Internal] 📊 Added planner analytics events for calendar export actions across details, info, and print surfaces.
- [ ] [Internal] 🎨 Tuned activity marker icon contrast and softened marker chrome for ongoing map-marker experimentation.
- [ ] [Internal] 🧭 Tightened initial map-fit guards so first-time activity selection no longer jumps back to route center.
- [ ] [Internal] 🧪 Rebalanced adaptive marker-tier thresholds, added city-only crowding compaction, and restored floating-map resize auto-fit so marker density and fit behavior stay stable across dock/float and orientation changes.
- [ ] [Internal] 🧭 Added structured route-failure reason classification to support future leg-level transport availability UX.
- [ ] [Internal] 🧠 Persisted failure reasons in route cache metadata and passed reason context through route-status updates.
- [ ] [Internal] 🔕 Added short-window deduping for repeated route fallback warnings on identical legs/modes.
- [ ] [Internal] 🧮 Updated route-distance status rendering to avoid indefinite "Calculating…" when no active route computation is running.
- [ ] [Internal] 🧪 Stabilized admin soft-delete browser regressions by making fixtures date-relative and extending async query timeouts under full-suite load.
