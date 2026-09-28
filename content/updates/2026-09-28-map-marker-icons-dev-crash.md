---
id: rel-2026-09-28-map-marker-icons-dev-crash
version: v0.200.0
title: "Map marker icons without a nested render"
date: 2026-09-28
published_at: 2026-09-28T16:45:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Activity marker icons are built as plain SVG strings, which ends a dev-server crash on the trip map."
---

## Changes
- [ ] [Internal] 🧭 Activity marker icons on the trip map are now plain SVG strings instead of a nested Preact string render, which crashed the dev server's map with "Hook can only be invoked from render methods". Production never loaded the debug checks that threw, so live trips were not affected.
- [ ] [Internal] 🧪 Added a regression test that reproduces the crash under the debug runtime and checks each marker glyph against the activity icon component.
