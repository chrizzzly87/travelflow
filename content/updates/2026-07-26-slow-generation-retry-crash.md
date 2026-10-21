---
id: rel-2026-07-26-slow-generation-retry-crash
version: v0.158.0
title: "Slow trip generation no longer breaks the trip view"
date: 2026-07-26
published_at: 2026-07-26T08:30:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Trips that take unusually long to generate stay usable, with the restart option available instead of a blank screen."
---

## Changes
- [x] [Fixed] ⏳ Trips that take longer than expected to generate no longer break the page — the trip view stays open while you wait.
- [x] [Fixed] 🔁 The option to stop and restart a slow generation now appears reliably instead of crashing the screen.
- [ ] [Internal] Passed the declared orchestration binding into the abort-and-retry capability check in TripView, fixing a ReferenceError thrown once `isGenerationSlow` became true.
- [ ] [Internal] Added a regression test asserting the abort-and-retry options object references a declared identifier.
