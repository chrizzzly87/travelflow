---
id: rel-2026-07-02-storage-quota-prune-notice
version: v0.137.0
title: "Warning when device storage runs out"
date: 2026-07-02
published_at: 2026-07-02T19:40:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "You now get a clear warning when older local trips had to be removed because your device storage was full."
---

## Changes
- [x] [Fixed] 💾 You'll now be warned if older local trips had to be removed to free up space on a full device — previously this happened silently.
- [ ] [Internal] Trip storage service emits a `tf:trips-pruned` window event with pruned count/titles; an app bootstrap hook converts it into a single localized warning toast.
- [ ] [Internal] Quota pruning now always keeps the trip that triggered the save, even when it carries the oldest `updatedAt` (e.g. sync writes with `preserveUpdatedAt`).
- [ ] [Internal] Added regression tests for prune notification, saved-trip protection, and the no-prune quiet path in `tests/browser/storageService.browser.test.ts`.
