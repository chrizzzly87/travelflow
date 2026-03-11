---
id: rel-2026-03-11-trip-page-layout-optimization
version: v0.0.0
title: "Trip pages are easier to manage across header, details, and map layouts"
date: 2026-03-11
published_at: 2026-03-11T16:20:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Reworked the trip-page header, moved trip details into a larger tabbed dialog, stabilized map and pane resizing across mobile and desktop, and added clearer calendar zoom controls."
---

## Changes
- [x] [Improved] 🧭 Trip pages now give the title more room in the header, let you open trip details directly from the title, and bring the Profile menu back to the far right while renaming the planner shortcut to Trips.
- [x] [Improved] 🗂️ Trip details now open in a larger tabbed dialog with dedicated sections for general trip info, edit history, exports, destination context, and admin-only diagnostics.
- [x] [Fixed] 🗺️ The planner now restores your desktop map layout more reliably after mobile resizing, keeps the map and details panes resizable, and gives the details panel a proper third-column role.
- [x] [Improved] 🔎 Calendar zoom controls now show labeled scale presets and include a Fit action so you can frame the whole trip faster.
- [ ] [Internal] 🧪 Added regression coverage for the new header entrypoint, tabbed trip dialog, persisted pane sizing, fit zoom controls, and selection visibility after layout changes.
