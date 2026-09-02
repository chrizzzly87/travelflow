---
id: rel-2026-09-01-faster-reliable-trip-generation
version: v0.160.0
title: "Faster, more reliable trip generation"
date: 2026-09-02
published_at: 2026-09-02T13:42:38Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Trip generation now uses a smaller structured plan and builds the final itinerary reliably on TravelFlow's servers."
---

## Changes
- [x] [Improved] ⚡ Trip generation uses fewer AI tokens while preserving the full itinerary shown in the planner.
- [x] [Fixed] 🧱 Malformed or incomplete generated trips are stopped before they can create a broken planner view.
- [x] [Fixed] 🛠️ Trips with a fixable scheduling mistake get one automatic correction attempt within the original time budget.
- [x] [Improved] 🗺️ New trips immediately focus the map on the first country while the detailed route is being prepared.
- [x] [Improved] 🔁 Round-trip return stops and transfer labels are now assembled consistently by TravelFlow.
- [ ] [Internal] 🧰 Added provider-specific structured-output schemas, targeted schedule repair tools, strict semantic validation, compiler telemetry, and repeatable model benchmarks.
