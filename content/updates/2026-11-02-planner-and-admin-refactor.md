---
id: rel-2026-11-02-planner-and-admin-refactor
version: v0.219.0
title: "Planner and admin refactoring"
date: 2026-11-02
published_at: 2026-11-02T09:00:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Behind-the-scenes cleanup of the trip planner and the AI benchmark admin, with no change to how they work."
---

## Changes
- [ ] [Internal] 🧩 The AI benchmark admin page is now a thin composition over `components/admin/ai-benchmark/`, down from 3,335 to about 200 lines.
- [ ] [Internal] 🗂️ Run setup, the model catalog, the session and its runs, and the screen state each have their own reducer, with unit tests.
- [ ] [Internal] 🔌 Loading and polling (session, models, preferences, telemetry) and the run, judging, export and setup actions live in separate hooks.
- [ ] [Internal] 🖍️ The template JSON is highlighted with rendered tokens instead of injected HTML; the markup is unchanged.
- [ ] [Internal] 🧪 A new browser flow test starts a run, opens it in the sheet, rates it and compares it, and passes against the old page too.
- [ ] [Internal] 📏 Moved the timeline zoom bookkeeping, zoom clamping and stepping, and the view-settings persist refs out of TripView into `useTripLayoutSizing`, called where its `trip.id` reset effect used to run.
- [ ] [Internal] ↔️ Moved the docked-pane rebalance layout effect into `useDockedPaneRebalance`, called right after `useTripResizeControls` as before.
- [ ] [Internal] 🎯 Moved the selected item and selected cities state, with the effect that drops them when their items leave the trip, into `useTripSelection`.
- [ ] [Internal] 🧪 Added hook tests for zoom and pane clamping, the reset on trip change, persist-ref flags and selection pruning, plus a source-order guard for the new hook call sites.
- [ ] [Internal] 🧪 The map provider tree test no longer fetches the live administrator map preset, so it passes with or without real keys in `.env.local`.
- [ ] [Internal] 📜 Restored the published v0.158.0 note (slow trip generation retry crash), which the stale-draft cleanup had removed.
