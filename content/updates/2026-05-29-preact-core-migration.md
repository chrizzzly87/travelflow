---
id: rel-2026-05-29-preact-core-migration
version: v0.122.0
title: "Faster Core Loading"
date: 2026-05-29
published_at: 2026-05-29T16:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Reduces the first-load JavaScript footprint so key pages can become usable sooner."
---

## Changes
- [x] [Improved] ⚡ Key pages now download less startup code, helping first visits become usable sooner.
- [ ] [Internal] 🧩 Swapped the production app runtime to Preact compat while keeping the existing React test harness stable.
