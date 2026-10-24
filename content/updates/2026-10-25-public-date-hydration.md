---
id: rel-2026-10-25-public-date-hydration
version: v0.210.0
title: "Up-to-date inspiration dates"
date: 2026-10-25
published_at: 2026-10-25T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Upcoming festivals, this month's picks and weekend ideas follow your own date as soon as a page opens."
---

## Changes
- [x] [Fixed] 📆 Upcoming festivals, this month's picks and weekend trip ideas now follow your own date, even on pages loaded right after midnight or from a saved copy.
- [ ] [Internal] 🕰️ Stamp server renders with their time and hydrate date-dependent public content from it before switching to the browser's local date.
- [ ] [Internal] 🪶 Load the Trip Agent schemas and the map customize panel only when they are used, shrinking the trip view's first script by 17% (measured locally).
