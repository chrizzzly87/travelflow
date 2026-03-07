---
id: rel-2026-03-07-bootstrap-shell-handoff
version: v0.0.0
title: "Bootstrap shell handoff keeps the app chrome visible during first load"
date: 2026-03-07
published_at: 2026-03-07T10:55:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Kept the branded header visible through the React handoff so route lazy-loading no longer flashes a blank white gap."
---

## Changes
- [x] [Improved] 🧭 First-load navigation now stays visible while the app hydrates, so opening a page feels faster and less blank.
- [x] [Improved] 🧳 Trip, shared-trip, and example-trip loading now keep a matching shell on screen until the first real planner view is ready.
- [ ] [Internal] 🧱 Added a shared React bootstrap shell and overlay handoff so static HTML chrome remains visible until the first React paint.
