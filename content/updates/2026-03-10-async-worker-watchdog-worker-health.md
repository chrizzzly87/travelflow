---
id: rel-2026-03-10-async-worker-watchdog-worker-health
version: v0.0.0
title: "Async trip generation now watches for stalled queues and self-recovers faster"
date: 2026-03-10
published_at: 2026-03-10T15:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Async trip generation now records worker heartbeats, auto-rekicks stale queued jobs, and runs a safe end-to-end canary so queue regressions are easier to catch before trips sit in limbo."
---

## Changes
- [x] [Improved] 🛟 Queued trip generation now watches for stalled background work and auto-rekicks the worker when jobs have been sitting too long, so trips are less likely to stay stuck in limbo.
- [ ] [Internal] 📈 Added durable async worker health rows for heartbeats, stale-queue incidents, and canary runs, plus a new admin worker-health dashboard for fast production triage.
- [ ] [Internal] 🧪 Added a provider-free invalid-payload canary that continuously proves the cron-to-background-worker drain path without spending model tokens.
