---
id: rel-2026-03-11-trip-page-layout-optimization
version: v0.0.0
title: "Trip pages are easier to manage across header, details, and map layouts"
date: 2026-03-11
published_at: 2026-03-11T16:20:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Reworked the trip-page header, flattened the trip details dialog layout, stabilized map and pane resizing across mobile and desktop, and improved calendar zoom, fit, checklist, and keyboard behavior."
---

## Changes
- [x] [Improved] 🧭 Trip pages now give the title more room in the header, let you open trip details directly from the title, and bring the Profile menu back to the far right while renaming the planner shortcut to Trips.
- [x] [Improved] 🗂️ Trip details now open in a larger tabbed dialog with a flatter, clearer layout for general info, edit history, exports, destination context, and admin-only diagnostics.
- [x] [Fixed] 🗺️ The planner now restores your desktop map layout more reliably after mobile resizing, keeps docked panes balanced across resize changes, keeps the floating map anchored when side panels grow or shrink, and adds a seam guard so docked maps stay out of the resize rail.
- [x] [Improved] 🔎 Calendar zoom controls now show the current scale in compact 0.2 steps, keep the familiar control sizing, and fill spare space with upcoming dates in both horizontal and vertical calendar layouts so the planner stays useful at smaller zoom levels.
- [x] [Improved] ✅ Timeline and notes checklists are easier to read, can be checked directly from the planner, and keep those checkbox changes saved with the trip.
- [x] [Improved] ⌨️ Selected city cards now support keyboard navigation between stays with Tab and arrow keys, and Enter or Space can open or close the linked details panel.
- [ ] [Internal] 🧪 Added regression coverage for the docked-map geometry retry, planner keyboard city navigation, fit zoom controls, rendered filler-day slots, and the updated pane-resize behavior.
