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
- [x] [Improved] 🟢 "Today" is highlighted with a badge and the timeline list auto-scrolls to today when opened.
- [ ] [Internal] 💾 Active view mode is now saved with each trip view state so reloads restore the selected mode.
- [ ] [Internal] ♻️ Undo and redo history now includes view-mode changes together with other planner view updates.
