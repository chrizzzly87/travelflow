---
id: rel-2026-07-02-flush-pending-commit
version: v0.131.0
title: "Reliable saving when leaving the page"
date: 2026-07-02
published_at: 2026-07-02T19:34:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Your very last edit is no longer lost when you close the tab right after making it."
---

## Changes
- [x] [Fixed] 💾 Your last edit is no longer lost when you close the tab or leave the page right after making it — it now syncs to your other devices and appears in the trip history.
- [ ] [Internal] Added `useTripCommitFlush` hook: flushes the debounced trip commit via `onCommitState` on TripView unmount and persists it synchronously to the offline change queue on `pagehide`/`visibilitychange -> hidden` for replay by `tripSyncManager`.
- [ ] [Internal] Added jsdom regression tests covering flush-on-unmount (exactly one commit), pagehide/hidden persistence, no-pending no-op, and listener cleanup.
