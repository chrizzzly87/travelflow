---
id: rel-2026-03-02-trip-planner-toast-dedup
version: v0.80.0
title: "Trip planner toast dedup and undo feedback stability"
date: 2026-03-02
published_at: 2026-03-02T20:46:48Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Trip planner now avoids duplicate action toasts and prevents recursive undo feedback loops."
---

## Changes
- [x] [Fixed] 🔔 Trip planner now shows one clear confirmation toast for favorite toggles and add/remove timeline actions.
- [x] [Fixed] ↩️ Undo/redo feedback toasts no longer include another Undo button, preventing confusing recursive undo behavior.
- [ ] [Internal] 🧪 Added regression tests to prevent duplicate planner toasts and recursive undo actions in history feedback.
