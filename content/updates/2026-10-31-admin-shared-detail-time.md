---
id: rel-2026-10-31-admin-shared-detail-time
version: v0.212.0
title: "Shared admin detail fields and relative times"
date: 2026-10-31
published_at: 2026-10-31T18:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Admin screens now share one relative-time format and one detail-field component."
---

## Changes
- [ ] [Internal] 🕰️ Every admin relative time now comes from the shared admin formatter, including the trips, legal terms, users and AI benchmark screens.
- [ ] [Internal] 📅 Added a day-granular variant to the shared formatter for legal terms effective dates.
- [ ] [Internal] 🧩 Users and trips detail sheets now share one detail-field component and one relative-timestamp component with the exact time in the tooltip.
- [ ] [Internal] ⏱️ Trip times under a minute now read "just now" instead of a seconds count, and admin time tooltips use the shared date format.
- [ ] [Internal] 🧪 Added tests for the shared time helpers and the shared detail components.
