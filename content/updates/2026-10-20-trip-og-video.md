---
id: rel-2026-10-20-trip-og-video
version: v0.0.0
title: "Animated trip sharing previews"
date: 2026-10-20
published_at: 2026-10-20T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Trip sharing previews can trace your route with animated city stops."
---

## Changes
- [x] [New feature] 🗺️ Share trips with a short map animation that reveals your route and city stops.
- [ ] [Internal] 🎞️ Generate six-second, wide or 4:3 H.264 previews asynchronously, capped at 2 MB, hourly automatic generation, five-minute explicit refresh cooldowns, and 20 renders per hour per deployment context.
- [ ] [Internal] 🖼️ Inspect trip images and videos in admin trip details and OG tools, apply Mapbox map and route styling, explicitly re-render while retaining the last working preview, reuse cached route geometry, and refresh cached previews, and optionally attach the final video frame as the sharing image.
- [x] [Fixed] 📍 Map animations now keep day trips and their return stays, with a standard map and colored journey legs.
- [ ] [Internal] 🔒 Keep existing image fallbacks and share-access checks, set explicit short metadata cache lifetimes, isolate preview media from production, and leave saved-version links image-only.
- [ ] [Improved] 📐 Choose a single cached video ratio, with a narrower map card, wider title space, and closer undistorted map framing.
