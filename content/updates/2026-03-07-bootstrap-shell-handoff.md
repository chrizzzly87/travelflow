---
id: rel-2026-03-07-bootstrap-shell-handoff
version: v0.0.0
title: "Bootstrap shell handoff keeps the app chrome visible during first load"
date: 2026-03-07
published_at: 2026-03-07T10:55:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Kept the branded header visible through the React handoff so first load no longer flashes a blank middle stage or mismatched shell."
---

## Changes
- [x] [Improved] 🧭 First-load navigation now stays visible while the app hydrates, so opening a page feels faster and less blank.
- [x] [Improved] 🧳 Trip, shared-trip, and example-trip loading now keep a route-aware top bar on screen until the first real planner view is ready.
- [ ] [Internal] 🧱 Replaced the marketing route fallback with the real React site header so the bootstrap handoff no longer jumps between different header layouts.
- [ ] [Internal] 🛠️ Fixed the bootstrap container markup so removing the pre-hydration shell no longer tears down the React root during the handoff.
