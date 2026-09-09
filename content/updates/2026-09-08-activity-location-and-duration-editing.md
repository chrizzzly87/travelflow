---
id: rel-2026-09-08-activity-location-and-duration-editing
version: v0.164.0
title: "Reschedule and relocate any activity"
date: 2026-09-08
published_at: 2026-09-08T12:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Activities can now be moved to another day, given a length in hours, pinned to the exact place you mean — and their pins show up on the map."
---

## Changes
- [x] [New feature] ⏱️ Give an activity the length it really has — set it in hours, from a half-hour coffee stop to a full day out.
- [x] [New feature] 📅 Move an activity to another day straight from its details, without dragging it across the timeline.
- [x] [New feature] 📍 Change where an activity happens: search for the venue and pick it, or write the spot in your own words.
- [x] [New feature] 🗺️ Activity pins now show on the map without switching anything on — they fade in as you zoom into a city and stay out of the way on a country-wide view.
- [x] [Improved] 🎯 Picking an activity always recenters the map on its pin, instead of leaving you to hunt for it near the edge.
- [x] [Improved] 🕐 Short activities now read as hours instead of a fraction of a day, so a three-hour visit looks like one.

- [ ] [Internal] 🧩 Reused the city schedule-draft state for activities, so the live timeline preview, Escape handling and Cancel/Apply behave identically for both item types.
- [ ] [Internal] 🔎 Split the Google Places lookup into a locality-biased city search and an unrestricted place search, and stored the picked coordinates on the activity.
- [ ] [Internal] 🧭 Added an opt-in `alwaysCenter` to the selection viewport resolver so activity focus recenters unconditionally while city focus keeps its stable-viewport behaviour.
- [ ] [Internal] 🧪 Unit coverage for the hour/day duration helpers, the marker default and zoom gate, plus a guard that pins the selection helpers duplicated across the map component and its test-only copy.
