---
id: rel-2026-07-02-readonly-undo-guard
version: v0.133.0
title: "Read-only trips ignore undo shortcuts"
date: 2026-07-02
published_at: 2026-07-02T19:36:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Shared view-only trips no longer react to undo or redo shortcuts."
---

## Changes
- [x] [Fixed] 🔒 Shared view-only trips no longer react to undo and redo keyboard shortcuts.
- [ ] [Internal] Version snapshot loads no longer persist trips to local storage when access is resolved as view-only.
