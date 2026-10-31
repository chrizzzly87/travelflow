---
id: rel-2026-10-31-split-root-utils
version: v0.212.0
title: "Split the shared app helpers into focused modules"
date: 2026-10-31
published_at: 2026-10-31T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Moves the large root helpers file into focused modules behind a re-export barrel, with no behaviour change."
---

## Changes
- [ ] [Internal] 🧩 Split the 1,600-line root helpers file into focused modules for trip URLs, distance, dates, city colours, countries, app language, timeline layout and trip compression.
- [ ] [Internal] 🛰️ Kept only pure, edge-safe helpers in the shared folder that edge functions import; browser- and storage-bound helpers live beside the app utilities.
- [ ] [Internal] 🔁 Turned the old helpers file into a re-export barrel, so every existing import keeps working unchanged.
