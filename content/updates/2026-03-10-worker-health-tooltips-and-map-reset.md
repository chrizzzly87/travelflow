---
id: rel-2026-03-10-worker-health-tooltips-and-map-reset
version: v0.0.0
title: "Worker health is easier to read and new trips open with a clean map"
date: 2026-03-10
published_at: 2026-03-10T20:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Clarified async worker health signals in admin and reset the planner map when opening a different trip so stale routes and pins do not leak across trips."
---

## Changes
- [x] [Fixed] 🗺️ Opening a newly created trip after finishing another one now starts from a clean planner map, so old pins and route lines no longer linger from the previous trip.
- [ ] [Internal] 🛟 The admin worker-health dashboard now explains heartbeat, watchdog, and canary checks in plain English and adds searchable, filterable pagination for recent health rows.
