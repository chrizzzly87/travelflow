---
id: rel-2026-07-02-share-link-validation
version: v0.136.0
title: "Safer shared trip links"
date: 2026-07-02
published_at: 2026-07-02T19:39:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Broken or tampered shared trip links now show a friendly page instead of an error screen."
---

## Changes
- [x] [Fixed] 🔗 Opening a broken or incomplete shared trip link now shows a friendly "trip unavailable" page instead of an error screen.
- [ ] [Internal] Added shape validation and normalization to shared-trip decode paths (`decompressTrip`, `decompressTripFromUrl`) with regression tests.
