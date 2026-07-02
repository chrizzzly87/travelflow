---
id: rel-2026-07-02-static-hero-underline
version: v0.0.0
title: "Hero headline paints instantly"
date: 2026-07-02
published_at: 2026-07-02T21:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The homepage headline and its underline accent now appear immediately with the page."
---

## Changes
- [x] [Improved] 🖊️ The homepage headline underline is now part of the page itself and draws in smoothly — the headline no longer waits for the app to finish loading.
- [ ] [Internal] Replaced the rough-notation JS underline (post-hydration DOM injection into the hero h1, which invalidated the prerendered LCP candidate and chained LCP behind the full JS boot) with a static inline SVG rendered identically on server and client; draw-in is CSS-only with prefers-reduced-motion support.
- [ ] [Internal] Removed the rough-notation dependency (sole consumer).
