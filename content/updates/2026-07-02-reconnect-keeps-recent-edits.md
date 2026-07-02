---
id: rel-2026-07-02-reconnect-keeps-recent-edits
version: v0.0.0
title: "Reconnect Keeps Your Recent Edits"
date: 2026-07-02
published_at: 2026-07-02T12:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Trips edited offline no longer revert to older server data when your connection comes back."
---

## Changes
- [x] [Fixed] 📶 Edits made while offline no longer disappear or briefly revert when your internet connection returns — your latest changes stay in place while they sync.
- [ ] [Internal] Trip loader reconnect refresh now compares local vs server `updatedAt` and treats pending offline queue entries as local-authoritative before adopting/persisting the server trip (`routes/TripLoaderRoute.tsx`).
- [ ] [Internal] Added `hasQueuedTripCommit(tripId)` helper to `services/offlineChangeQueue.ts` with unit coverage, plus phase-2 regression tests for stale-server reconnect re-runs in `tests/browser/routes/tripLoaderRoute.browser.test.ts`.
