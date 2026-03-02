---
id: rel-2026-03-02-trip-planner-toast-dedup
version: v0.80.0
title: "Trip planner toast dedup for favorite and activity removal"
date: 2026-03-02
published_at: 2026-03-02T19:41:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Trip planner actions now avoid duplicate confirmation toasts when favoriting trips or removing activities."
---

## Changes
- [x] [Fixed] 🔔 Trip planner now shows one clear confirmation toast when you favorite a trip or remove an activity.
- [ ] [Internal] 🧪 Added regression tests to prevent duplicate planner toasts when action feedback and auto-save feedback overlap.
