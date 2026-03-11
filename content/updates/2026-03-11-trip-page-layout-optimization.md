---
id: rel-2026-03-11-trip-page-layout-optimization
version: v0.0.0
title: "Trip pages are easier to manage across header, details, and map layouts"
date: 2026-03-11
published_at: 2026-03-11T16:20:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Reworked the trip-page header, flattened the trip details dialog layout, stabilized map and pane resizing across mobile and desktop, and improved calendar zoom and checklist behavior."
---

## Changes
- [x] [Improved] 🧭 Trip pages now give the title more room in the header, let you open trip details directly from the title, and bring the Profile menu back to the far right while renaming the planner shortcut to Trips.
- [x] [Improved] 🗂️ Trip details now open in a larger tabbed dialog with a flatter, clearer layout for general info, edit history, exports, destination context, and admin-only diagnostics.
- [x] [Fixed] 🗺️ The planner now restores your desktop map layout more reliably after mobile resizing, keeps docked panes balanced across resize changes, and prevents the floating map from covering the open details sidebar.
- [x] [Improved] 🔎 Calendar zoom controls now show the current scale, step through cleaner zoom levels, and let Fit work both for zooming in and zooming back out to frame the whole trip.
- [x] [Improved] ✅ Timeline and notes checklists are easier to read, can be checked directly from the planner, and keep those checkbox changes saved with the trip.
- [ ] [Internal] 🧪 Added regression coverage for the new header entrypoint, tabbed trip dialog, persisted pane sizing, fit zoom controls, and selection visibility after layout changes.
