---
id: rel-2026-03-18-tripview-regression-restore
version: v0.0.0
title: "Trip view restores safer panel and menu behavior"
date: 2026-03-18
published_at: 2026-03-18T20:55:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Restores calmer trip-page behavior so panel resizing stays balanced, transport changes stick, and My Trips opens without the account menu lingering above it."
---

## Changes
- [x] [Fixed] 🧭 Trip view now rebalances the planner more reliably again, so the calendar, map, and details panel share space more predictably and horizontal calendars auto-fit when layout or detail-panel changes squeeze them.
- [x] [Fixed] 🚌 Changing a transport type no longer snaps back when a stale route calculation finishes a moment later.
- [x] [Fixed] 🗂️ Opening My Trips from the account menu now closes the dropdown first, so the side panel can take focus without overlapping profile actions.
- [ ] [Internal] 🧪 Added browser regression coverage for planner auto-fit on layout changes, the account-menu handoff into My Trips, and the transport-mode race window.
