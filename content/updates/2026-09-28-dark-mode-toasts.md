---
id: rel-2026-09-28-dark-mode-toasts
version: v0.203.0
title: "Readable notifications in dark mode"
date: 2026-09-28
published_at: 2026-09-28T19:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Pop-up notifications now use the dark design in dark mode, so their titles and icons are easy to read."
---

## Changes
- [x] [Fixed] 🌙 Pop-up notifications now switch to a dark card in dark mode instead of staying white, so titles, icons and messages are readable again.
- [x] [Fixed] 🎨 Notification borders now pick up their colour (success, info, warning, error) in both light and dark mode.
- [ ] [Internal] The toast container follows the app theme store and maps Sonner's surface variables to the design tokens; regression test added.
