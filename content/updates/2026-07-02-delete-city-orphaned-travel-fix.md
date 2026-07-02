---
id: rel-2026-07-02-delete-city-orphaned-travel-fix
version: v0.130.0
title: "Cleaner timeline when removing a stop"
date: 2026-07-02
published_at: 2026-07-02T19:33:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Removing a city from your trip now also cleans up its transfers and activities."
---

## Changes
- [x] [Fixed] 🧹 Removing a stop from your trip no longer leaves broken transfer entries or leftover activities behind.
- [ ] [Internal] Added `removeTimelineItemWithLinkedItems` util that cascades city deletion to positionally linked travel segments and activities, with regression tests; strategy-based gap handling (DeleteCityModal) remains a follow-up.
