---
id: rel-2026-10-31-split-db-service
version: v0.212.0
title: "Data layer split by domain"
date: 2026-10-31
published_at: 2026-10-31T18:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The Supabase data layer now lives in smaller modules grouped by domain, with no change in behaviour."
---

## Changes
- [ ] [Internal] 🗂️ Split the 2,447-line database service into modules for sessions, trips, trip events, sharing, anonymous asset claims, user settings and airports, moving the code without changing it.
- [ ] [Internal] 🚪 Kept the original database service file as a barrel with the same 43 public names, so existing imports and test mocks keep working unchanged.
- [ ] [Internal] 📦 Confirmed the database code still ships in its own lazy-loaded chunk, outside the app's startup bundle.
