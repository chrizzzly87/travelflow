---
id: rel-2026-07-02-trip-map-preview-hardening
version: v0.0.0
title: "Trip map preview hardening"
date: 2026-07-02
published_at: 2026-07-02T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Trip map preview images load faster thanks to stronger caching, with new protections against abusive traffic."
---

## Changes
- [x] [Improved] 🗺️ Trip map preview images now load faster on repeat visits thanks to stronger caching.
- [ ] [Internal] Added strict coordinate validation (count cap, lat/lng range and format checks) to the trip map preview edge function.
- [ ] [Internal] Added per-IP token-bucket rate limiting with a higher cost for realistic-route previews to protect paid Directions API quota.
- [ ] [Internal] Added durable CDN caching with an allowlisted query cache key (Netlify-Vary) so junk params cannot bust the preview cache.
- [ ] [Internal] Extracted reusable preview guard helpers into netlify/edge-lib with Vitest coverage.
