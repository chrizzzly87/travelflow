---
id: rel-2026-09-01-faster-reliable-trip-generation
version: v0.160.0
title: "Faster, more reliable trip generation"
date: 2026-09-01
published_at: 2026-09-01T16:55:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Trip generation now uses a smaller structured plan and builds the final itinerary reliably on TravelFlow's servers."
---

## Changes
- [x] [Improved] ⚡ Trip generation uses fewer AI tokens while preserving the full itinerary shown in the planner.
- [x] [Fixed] 🧱 Malformed or incomplete generated trips are stopped before they can create a broken planner view.
- [x] [Improved] 🔁 Round-trip return stops and transfer labels are now assembled consistently by TravelFlow.
- [ ] [Internal] 🧰 Added provider-specific structured-output schemas, strict semantic validation, compiler telemetry, and repeatable model benchmarks.
