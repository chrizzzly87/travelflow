---
id: rel-2026-02-28-trip-page-calendar-and-timeline-list-mode
version: v0.75.0
title: "Trip page calendar and timeline list mode"
date: 2026-03-01
published_at: 2026-03-01T17:05:17Z
status: published
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
- [x] [Improved] 🔲 Timeline transfer pills now show a clear selected outline state to match calendar-style selection feedback.
- [x] [Improved] 🟢 "Today" is highlighted with a badge and the timeline list auto-scrolls to today when opened.
- [x] [Improved] 🎛️ Calendar/list mode switching now uses icon-only controls with accessible labels, with the mode toggle pinned to the far right.
- [x] [Improved] 🗺️ Scrolling through timeline list sections now keeps map focus in sync by highlighting the city currently in view.
- [x] [Fixed] 🔁 Calendar mode now stays selected reliably instead of occasionally snapping back to timeline mode after background refreshes.
- [x] [Improved] ↔️ Calendar and list mode icon tabs now use consistent spacing so the controls no longer feel crowded.
- [x] [Improved] 🎯 Switching from calendar to timeline list now keeps the active selection and scrolls to the selected city or activity automatically.
- [x] [Improved] 🧭 Timeline list now opens in a neutral state with no auto-selected details unless you already selected something.
- [x] [Improved] 🔴 Timeline list "Today" badges now match the calendar-style red emphasis with uppercase visual treatment.
- [x] [Fixed] 📍 Timeline list now reliably smooth-scrolls to the current-day marker after load when that marker starts outside the visible viewport.
- [x] [Improved] 🧩 Scrolling through timeline chapters now updates details only when a selection is already open, avoiding unwanted panel opens from passive scrolling.
- [x] [Fixed] 🧵 Versioned trip links now keep the selected calendar/list mode stable even when delayed sync refreshes arrive.
- [x] [Improved] 🗺️ Map controls now stay visible even when the map is unavailable, while map-only actions stay safely disabled until map load succeeds.
- [ ] [Internal] 💾 Active view mode is now saved with each trip view state so reloads restore the selected mode.
- [ ] [Internal] ♻️ Undo and redo history now includes view-mode changes together with other planner view updates.
- [ ] [Internal] 📊 Timeline list interactions now emit dedicated trip-view analytics events for city, activity, and transfer detail opens.
- [ ] [Internal] 🧾 Timeline control commits now record structured trip update events with visual-change details for admin audit timelines.
