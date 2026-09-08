---
id: rel-2026-09-08-admin-global-settings
version: v0.163.0
title: "One place for the app-wide switches"
date: 2026-09-08
published_at: 2026-09-08T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Administrators can switch the planning chat, the default AI model and the starting map style without touching the database."
---

## Changes
- [x] [Improved] 🗺️ New trips open on the map style the team chose as the default — and the moment you pick your own style, yours is what you keep.

- [ ] [Internal] 🗺️ Added a map provider switch to Global Settings (Google everywhere, Mapbox visuals with Google services, or Mapbox everywhere). Generated preview images read the same setting at the edge, so a shared image cannot show a different basemap than the planner.
- [ ] [Internal] 🎛️ Added an admin Global Settings page for the app-wide runtime switches: the Trip Agent rollout and its administrator preview, the default AI model with the approved-model list and age limit, the default map style, and the planner beta gate.
- [ ] [Internal] 🔐 Added an admin-only settings writer where every argument is optional, so one section saves without overwriting the rest of the row.
- [ ] [Internal] 🧪 Regression coverage for the new settings normalization, including an unknown map style falling back to the standard one.
