---
id: rel-2026-02-24-admin-trip-ops-real-data
version: v0.57.0
title: "Admin trips real-data recovery and action controls"
date: 2026-02-24
published_at: 2026-02-24T12:55:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Admin overview and trip operations now stay on live records, with expanded trip actions in both the table and side panel."
---

## Changes
- [ ] [Fixed] 🧭 Admin overview and trip controls now stay connected to live backend records on production runtime.
- [ ] [Improved] 🛠️ Added per-trip admin actions in the trips table: preview, duplicate, transfer owner, JSON export, soft delete, and hard delete.
- [ ] [Improved] 🗂️ Added matching trip action workflows in the side panel, including owner transfer controls near owner context.
- [ ] [Improved] 🚨 Added admin workspace data-source banners that explain active debug/mock mode and cached fallback reasons.
- [x] [Improved] ✉️ Login now better supports saved email autofill with stronger form accessibility labeling.
- [ ] [Internal] 🧪 Added regression coverage for the admin mock-mode guard to prevent production mock-data leakage.
