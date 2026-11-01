---
id: rel-2026-11-01-tripview-generation-polling
version: v0.217.0
title: "Trip warnings stay in their own section"
date: 2026-11-01
published_at: 2026-11-01T13:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Trip warnings no longer show text from the next section of a city's notes."
---

## Changes
- [x] [Fixed] ⚠️ Trip warnings no longer pick up text from the next section of a city's notes when a city has an empty warnings section.
- [ ] [Internal] 🔄 Moved the trip generation clock, saved-trip polling and queue worker nudge out of TripView into `useTripGenerationPolling`, with fake-timer hook tests for cadence, completion, trip changes and unmount cleanup.
- [ ] [Internal] 🧪 Added a regression test for an empty Heads Up section followed by another heading.
