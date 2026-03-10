---
id: rel-2026-03-10-server-owned-async-dispatch
version: v0.0.0
title: "Async trip generation now starts server-side as soon as jobs are queued"
date: 2026-03-10
published_at: 2026-03-10T16:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Async trip generation now hands the first worker kickoff to a server-owned enqueue path so trips can keep moving even when the browser tab closes right after start."
---

## Changes
- [x] [Improved] 🚀 Async trip generation now hands off the first background kickoff to the server as soon as a trip is queued, so trips can keep progressing even if you leave the page right after starting them.
- [x] [Improved] 👀 Returning to a trip later now has a better chance of loading the finished itinerary immediately because the first worker start no longer depends on the open tab staying alive.
- [ ] [Internal] 🧱 Added a dedicated authenticated enqueue endpoint that queues the job and immediately dispatches the background worker in one server-owned step, while leaving cron/watchdog recovery as a backup.
- [ ] [Internal] 🧪 Hardened the async worker cron canary tests so production deploys stay stable when a dedicated canary owner is configured.
- [ ] [Internal] ⏱️ Taught the async worker canary to wait briefly for terminal worker results so healthy background processing no longer reports false failures.
