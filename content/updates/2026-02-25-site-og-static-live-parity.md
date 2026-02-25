---
id: rel-2026-02-25-site-og-static-live-parity
version: v0.62.0
title: "Static OG visual parity with live renderer"
date: 2026-02-25
published_at: 2026-02-25T10:50:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Static pre-generated Open Graph images now match live-rendered OG visuals more closely, including icon sizing and safer footer URL fitting."
---

## Changes
- [x] [Fixed] 🖼️ Pre-generated social preview images now align with live OG card visuals so icons, spacing, and footer URL rendering stay consistent across static and on-the-fly cards.
- [ ] [Internal] 🧩 Updated the static OG SVG template revision and switched PNG export to full RGBA output to remove palette artifacts from generated cards.
