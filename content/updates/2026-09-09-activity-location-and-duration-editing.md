---
id: rel-2026-09-09-activity-location-and-duration-editing
version: v0.165.0
title: "Activities you can move, reshape and find"
date: 2026-09-09
published_at: 2026-09-09T05:16:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Give an activity its real length, move it to another day, pin it to the exact place — and let the map take you straight there."
---

## Changes
- [x] [New feature] ⏱️ An activity is no longer stuck at a full day. Set how long it really takes — a half-hour coffee stop, a three-hour museum, an all-day hike — and the timeline shows it at that size.
- [x] [New feature] 📅 Changed your mind about which day something belongs on? Move it from the activity itself, and it keeps its length instead of being dragged across the timeline.
- [x] [New feature] 📌 Say where an activity actually happens. Search for the venue and pick it from the results, or simply write the spot in your own words.
- [x] [New feature] 🗺️ Activity pins are on the map from the start. They stay out of the way while you take in the whole country, and appear as you zoom toward a city.
- [x] [Improved] 🎯 Pick an activity and the map travels to its pin and centres it, instead of leaving you to spot it somewhere near the edge.
- [x] [Improved] 🕐 A short activity now reads as three hours rather than a tenth of a day.

- [ ] [Internal] 🧩 Reused the city schedule-draft state for activities, so the live timeline preview, Escape handling and Cancel/Apply behave identically for both item types.
- [ ] [Internal] 🔎 Split the Google Places lookup into a locality-biased city search and an unrestricted place search, and stored the picked coordinates on the activity.
- [ ] [Internal] 🧭 Added an opt-in `alwaysCenter` to the selection viewport resolver so activity focus recenters unconditionally while city focus keeps its stable-viewport behaviour.
- [ ] [Internal] 🎚️ Flipped the activity-marker default to on; the existing zoom gate already keeps the pins out of a country-wide view, so the tuning was left untouched.
- [ ] [Internal] 🧪 Unit coverage for the hour/day duration helpers, the marker default and zoom gate, plus a guard that pins the selection helpers duplicated across the map component and its test-only copy.
