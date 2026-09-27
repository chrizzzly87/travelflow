---
id: rel-2026-09-27-trip-controls-translated
version: v0.194.0
title: "Trip controls speak your language"
date: 2026-09-27
published_at: 2026-09-27T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Map, timeline and banner controls on the trip page now follow your app language, including for screen readers."
---

## Changes
- [x] [Improved] 🗣️ Map and timeline buttons on the trip page now read out in your app language for screen readers and tooltips, not in English.
- [x] [Improved] 🧭 The example trip notice, the shared-trip strip and the snapshot notice now appear in your language.
- [x] [Improved] 🪟 The floating map preview's move, resize and rotate controls are labelled in your language.
- [ ] [Internal] 🌐 Moved the hard-coded trip page labels into the shared locale bundle for all eleven languages and reused existing labels where they already existed.
- [ ] [Internal] 🧪 Tests now render with the real English bundle, and a German render test guards against labels falling back to English.
