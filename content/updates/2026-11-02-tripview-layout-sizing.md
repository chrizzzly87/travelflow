---
id: rel-2026-11-02-tripview-layout-sizing
version: v0.219.0
title: "Trip planner layout and selection internals"
date: 2026-11-02
published_at: 2026-11-02T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Internal cleanup of how the trip planner sizes its panes and tracks the current selection."
---

## Changes
- [ ] [Internal] 📏 Moved the timeline zoom bookkeeping, zoom clamping and stepping, and the view-settings persist refs out of TripView into `useTripLayoutSizing`, called where its `trip.id` reset effect used to run.
- [ ] [Internal] ↔️ Moved the docked-pane rebalance layout effect into `useDockedPaneRebalance`, called right after `useTripResizeControls` as before.
- [ ] [Internal] 🎯 Moved the selected item and selected cities state, with the effect that drops them when their items leave the trip, into `useTripSelection`.
- [ ] [Internal] 🧪 Added hook tests for zoom and pane clamping, the reset on trip change, persist-ref flags and selection pruning, plus a source-order guard for the new hook call sites.
