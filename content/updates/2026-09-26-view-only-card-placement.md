---
id: rel-2026-09-26-view-only-card-placement
version: v0.193.0
title: "The view-only card makes room for Plan with AI"
date: 2026-09-26
published_at: 2026-09-26T13:14:02Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "On shared view-only trips, the notice card now sits above the Plan with AI button and stays readable over any map style in dark mode."
---

## Changes
- [x] [Fixed] 🧱 The view-only card on shared trips no longer sits underneath the "Plan with AI" button, on phones or on desktop.
- [x] [Fixed] 🌗 In dark mode the view-only card has a solid background, so its text stays readable over light map styles too.
- [ ] [Internal] 🔌 TripViewModalLayer received the launcher flag but never forwarded it to the card, so the v0.192.0 placement never took effect; the prop is now required, and a guard test checks every corner-card render site passes it.
