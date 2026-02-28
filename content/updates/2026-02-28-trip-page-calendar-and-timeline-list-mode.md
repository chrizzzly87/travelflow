---
id: rel-2026-02-28-trip-page-calendar-and-timeline-list-mode
version: v0.63.0
title: "Trip page calendar and timeline list mode"
date: 2026-02-28
published_at: 2026-02-28T18:30:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Trip planning now supports a modern timeline list mode with today-focused navigation and saved view preferences."
---

## Changes
- [x] [New feature] 🗓️ The trip page now has a clear mode switch between calendar and timeline list views.
- [x] [Improved] 🧭 Timeline list mode now groups plans by city with sticky city headers, connected dots, and activities ordered by schedule.
- [x] [Improved] ✨ Timeline list mode now uses a cleaner editorial layout with a continuous vertical spine and simplified typography-first activity rows.
- [x] [Improved] 🚆 City-to-city transfer pills are now shown on the timeline spine and can be clicked to open transfer details directly.
- [x] [Improved] 📝 City and activity notes in timeline list mode now render markdown formatting correctly.
- [x] [Improved] 🧷 Timeline list sticky behavior now keeps only the city heading pinned while long section content scrolls naturally.
- [x] [Improved] 🌍 Multi-country trips now show a country rooftitle above each city heading for faster orientation while reading.
- [x] [Improved] 🖱️ Activity titles in timeline list mode now use clearer hover affordances with subtle directional motion to signal clickability.
- [x] [Improved] 🟢 "Today" is highlighted with a badge and the timeline list auto-scrolls to today when opened.
- [x] [Improved] 🎛️ Calendar/list mode switching now uses icon-only controls with accessible labels, with the mode toggle pinned to the far right.
- [x] [Improved] 🗺️ Map controls now stay visible even when the map is unavailable, while map-only actions stay safely disabled until map load succeeds.
- [ ] [Internal] 💾 Active view mode is now saved with each trip view state so reloads restore the selected mode.
- [ ] [Internal] ♻️ Undo and redo history now includes view-mode changes together with other planner view updates.
- [ ] [Internal] 📊 Timeline list interactions now emit dedicated trip-view analytics events for city, activity, and transfer detail opens.
