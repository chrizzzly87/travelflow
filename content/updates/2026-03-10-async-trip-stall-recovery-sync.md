---
id: rel-2026-03-10-async-trip-stall-recovery-sync
version: v0.0.0
title: "Async trip recovery now rechecks finished plans before forcing a failure"
date: 2026-03-10
published_at: 2026-03-10T15:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Trip stall recovery now refreshes the remote trip before writing a synthetic queue-missing failure, preventing finished plans from being mislabeled after late worker completions."
---

## Changes
- [x] [Fixed] 🧾 Trip retries no longer mislabel a finished plan as failed when background generation completes just before the planner refreshes.
- [ ] [Internal] 🛟 Async stall recovery now refreshes the remote trip before writing the queue-missing fallback failure, avoiding false attempt-log errors after a successful worker completion.
- [ ] [Internal] 🔎 Worker auth and background dispatch now emit safe diagnostics for unauthorized and failed internal generation kicks, making queued-trip incidents faster to trace in production.
