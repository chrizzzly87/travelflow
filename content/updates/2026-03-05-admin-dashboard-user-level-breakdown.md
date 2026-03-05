---
id: rel-2026-03-05-admin-dashboard-user-level-breakdown
version: v0.84.0
title: "Admin dashboard user-level breakdown in Total Users card"
date: 2026-03-05
published_at: 2026-03-05T17:12:15Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Updated the admin dashboard Total Users card to show a clear breakdown by user level with total-share tooltips."
---

## Changes
- [ ] [Internal] 📊 Refreshed admin dashboard visuals with stacked Tremor bar charts for cumulative user levels over time, trip status trends, and a new users-vs-trips throughput view.
- [ ] [Internal] 🗓️ Corrected dashboard date-range scoping so charted trip/user trends consistently follow the selected range by creation time.
- [ ] [Internal] 📅 Standardized dashboard chart date labels to `DD.MM` (year omitted for current yearly scope).
- [ ] [Internal] 🧭 Updated shared table scroll containment so hovering admin data tables no longer blocks vertical page scrolling.
