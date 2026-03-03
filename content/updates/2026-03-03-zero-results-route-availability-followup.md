---
id: rel-2026-03-03-zero-results-route-availability-followup
version: v0.0.0
title: "Route reliability follow-up for ZERO_RESULTS and transport availability"
date: 2026-03-03
published_at: 2026-03-03T10:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Started follow-up work to make route failures more deterministic and reduce noisy fallback behavior."
---

## Changes
- [x] [New feature] 📅 Added one-click calendar exports for single activities, full activity plans, city stays, and complete itineraries from planner details, trip info, and print view.
- [x] [New feature] 🗺️ Activity markers now match activity-type chip colors/icons, support direct map selection, show hover labels, can be toggled on/off with zoom-aware visibility, and keep viewport behavior stable during activity edits.
- [x] [Improved] 📍 The Husum blog’s interactive map now uses in-app markers with softer accent styling, a cleaner left-side category accordion, and a full-height right-side map panel.
- [x] [Improved] 🧭 Map markers now auto-adapt by map size/zoom/route density, including an ultra-compact micro mode with slimmer route strokes, tighter markers, and hidden transport bubbles.
- [ ] [Internal] 🧱 Introduced a shared calendar file generator so all exports consistently include app attribution and canonical trip links.
- [ ] [Internal] 📊 Added planner analytics events for calendar export actions across details, info, and print surfaces.
- [ ] [Internal] 🎨 Tuned activity marker icon contrast and softened marker chrome for ongoing map-marker experimentation.
- [ ] [Internal] 🧭 Tightened initial map-fit guards so first-time activity selection no longer jumps back to route center.
- [ ] [Internal] 🧪 Rebalanced adaptive marker-tier thresholds so default/compact/micro transitions now respond predictably across docked/floating resize and zoom changes.
- [ ] [Internal] 🧭 Added structured route-failure reason classification to support future leg-level transport availability UX.
- [ ] [Internal] 🧠 Persisted failure reasons in route cache metadata and passed reason context through route-status updates.
- [ ] [Internal] 🔕 Added short-window deduping for repeated route fallback warnings on identical legs/modes.
- [ ] [Internal] 🧮 Updated route-distance status rendering to avoid indefinite "Calculating…" when no active route computation is running.
- [ ] [Internal] 🧪 Stabilized admin soft-delete browser regressions by making fixtures date-relative and extending async query timeouts under full-suite load.
