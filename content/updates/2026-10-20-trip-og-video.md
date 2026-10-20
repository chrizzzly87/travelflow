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
- [ ] [Internal] 🎞️ Generate six-second, 1200 × 630 H.264 previews asynchronously, capped at 2 MB, one render per trip per hour, and 20 renders per hour per deployment context.
- [ ] [Internal] 🖼️ Inspect trip images and videos in admin trip details and OG tools, choose clean or dark video styling, and optionally attach the final video frame as the sharing image.
- [ ] [Internal] 🔒 Keep existing image fallbacks and share-access checks, isolate preview media from production, and leave saved-version links image-only.
