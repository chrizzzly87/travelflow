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
- [x] [New feature] 🗺️ Activity markers now match activity-type chip colors/icons, support direct map selection, and show hover labels for faster scanning.
- [x] [Improved] 📍 The Husum blog’s interactive map now uses in-app markers, and category tabs immediately show or hide the corresponding places on the map.
- [ ] [Internal] 🧱 Introduced a shared calendar file generator so all exports consistently include app attribution and canonical trip links.
- [ ] [Internal] 📊 Added planner analytics events for calendar export actions across details, info, and print surfaces.
- [ ] [Internal] 🎨 Tuned activity marker icon contrast and softened marker chrome for ongoing map-marker experimentation.
- [ ] [Internal] 🧭 Added structured route-failure reason classification to support future leg-level transport availability UX.
- [ ] [Internal] 🧠 Persisted failure reasons in route cache metadata and passed reason context through route-status updates.
- [ ] [Internal] 🔕 Added short-window deduping for repeated route fallback warnings on identical legs/modes.
- [ ] [Internal] 🧮 Updated route-distance status rendering to avoid indefinite "Calculating…" when no active route computation is running.
- [ ] [Internal] 🧪 Stabilized admin soft-delete browser regressions by making fixtures date-relative and extending async query timeouts under full-suite load.
