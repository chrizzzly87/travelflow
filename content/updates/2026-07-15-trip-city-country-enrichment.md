---
id: rel-2026-07-15-trip-city-country-enrichment
version: v0.157.0
title: "More reliable city markers"
date: 2026-07-15
published_at: 2026-07-15T19:42:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Generated trips now keep stronger city and country location data for reliable map placement."
---

## Changes
- [x] [Fixed] 📍 City markers now use saved coordinates and country context to avoid ambiguous map placement.
- [ ] [Internal] 🗺️ Added a resumable location backfill for existing saved trips.
