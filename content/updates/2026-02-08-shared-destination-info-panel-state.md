---
id: rel-2026-02-08-shared-destination-info-panel-state
version: v0.14.0
title: "Shared destination info panel state persistence"
date: 2026-02-08
published_at: 2026-02-08T17:00:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Shared trips now remember whether the Destination Info panel was open or closed when the link was generated."
---

## Changes
- [x] [Fixed] 🧠 Added Destination Info panel open/closed state to shared view settings so recipients see the same panel state.
- [ ] [Internal] 🧠 Wired the panel expansion flag into planner view-state commits and shared snapshot persistence.
