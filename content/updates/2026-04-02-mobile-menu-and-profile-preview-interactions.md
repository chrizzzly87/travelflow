---
id: rel-2026-04-02-mobile-menu-and-profile-preview-interactions
version: v0.108.0
title: "Mobile menu and profile preview interactions feel reliable again"
date: 2026-04-02
published_at: 2026-04-02T15:59:18Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Fixes the mobile navigation drawer, sharpens button affordances with clearer pointer and focus feedback, and makes profile trip previews easier to open."
---

## Changes
- [x] [Fixed] 📱 The mobile menu now closes reliably again, keeps admin/logout/footer actions anchored to the bottom, temporarily removes stamps and public-profile shortcuts from the drawer, and restores the translated Create Trip quick action on profile.
- [x] [Improved] 🧭 Profile trip previews now open directly from the map snapshot and trip title, with clearer hover feedback on clickable headlines.
- [x] [Improved] 🎯 Buttons and dropdown actions now consistently show a pointer cursor and a larger accent-colored focus treatment across the app shell.
- [ ] [Internal] 🧪 Added browser regression coverage for the mobile drawer close flow and the new profile preview click targets.
