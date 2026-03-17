---
id: rel-2026-03-17-create-trip-notes-below-dates-regression
version: v0.0.0
title: "Create Trip keeps special notes below the travel dates again"
date: 2026-03-17
published_at: 2026-03-17T20:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The classic Create Trip form restores the special notes field directly below the calendar so trip details flow in the expected order again."
---

## Changes
- [x] [Fixed] 🗓️ The classic Create Trip form now keeps the special notes field directly below the travel dates again, instead of pushing it down below later planner sections.
- [ ] [Internal] 🧪 Added a browser regression test so future planner UI refactors keep the dates-to-notes section order intact.
