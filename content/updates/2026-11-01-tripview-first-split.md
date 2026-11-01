---
id: rel-2026-11-01-tripview-first-split
version: v0.216.0
title: "Trip planner code split, part one"
date: 2026-11-01
published_at: 2026-11-01T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Internal cleanup of the trip planner screen with no visible change."
---

## Changes
- [ ] [Internal] 🧩 Moved the trip planner's pure layout constants and helpers (negative-offset normalisation, Heads Up warnings, trip summary, view-transition helpers) into `components/tripview/tripViewModel.ts`, with unit tests.
- [ ] [Internal] 🪟 Moved the lazy modal layer into `components/tripview/TripViewModalLayer.tsx`; every modal keeps its own lazy chunk and recovery key.
- [ ] [Internal] 📅 Extracted the calendar export handlers into `useTripCalendarExport`, with hook tests for scopes, sources and stable handler identities.
