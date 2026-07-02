---
id: rel-2026-07-02-default-trip-dates-timezone-fix
version: v0.129.0
title: "Correct Suggested Trip Dates in All Timezones"
date: 2026-07-02
published_at: 2026-07-02T19:32:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Suggested trip start dates now always land on the intended Friday, no matter your timezone."
---

## Changes
- [x] [Fixed] 📅 Suggested trip dates in the planner and inspiration ideas now always land on the intended day — travelers east of GMT no longer saw start dates shifted one day earlier.
- [ ] [Internal] Added `formatLocalIsoDate` to `shared/tripSpan.ts` and used it in `getDefaultTripDates` (utils.ts) and `InspirationsPage.tsx`, replacing `toISOString().split('T')[0]` which converts local midnight to the previous UTC day in UTC+ timezones.
- [ ] [Internal] `getDefaultTripDates` now accepts an optional `now: Date` parameter for deterministic testing; regression tests in `tests/unit/defaultTripDates.test.ts` run under a forced `Europe/Berlin` timezone.
