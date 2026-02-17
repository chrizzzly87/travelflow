---
id: rel-2026-02-13-mobile-trip-header-info-history-actions
version: v0.47.0
title: "Mobile trip header action cleanup"
date: 2026-02-13
published_at: 2026-02-17T20:04:10Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Removed duplicate mobile info controls and restored quick access to change history from the trip header."
---

## Changes
- [x] [Fixed] 🧭 Mobile trip headers now show one clear info action, and the second duplicate icon is replaced with direct history access.
- [x] [Improved] 📌 On mobile, the My Plans action is now pinned to the far right of the header action row for consistent placement.
- [ ] [Internal] 📊 Added `app__trip_history--open` analytics tracking for desktop and mobile header history triggers.
- [ ] [Internal] 📝 Updated agent instruction files so release-note copy no longer asks for EN/DE translation or style sign-off by default.
