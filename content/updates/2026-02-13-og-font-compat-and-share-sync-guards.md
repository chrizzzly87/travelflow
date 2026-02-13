---
id: rel-2026-02-13-og-font-compat-and-share-sync-guards
version: v0.39.0
title: "OG image rendering restored and share-sync guard tightened"
date: 2026-02-13
published_at: 2026-02-13T15:36:57Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Fixed Open Graph image rendering crashes and prevented share-link generation from proceeding when a trip is not yet persisted."
---

## Changes
- [x] [Fixed] 🖼️ Restored `/api/og/site` and `/api/og/trip` rendering with consistent Bricolage Grotesque typography by loading matching Satori-compatible `.woff` files per weight (`400/700/800`) and falling back to Google Fonts/CDN sources when needed.
- [x] [Improved] 🔗 Added a pre-share persistence check so share-link creation stops early when a trip is not synced to the database yet, avoiding backend `P0001` failures.
