---
id: rel-2026-02-13-og-font-compat-and-share-sync-guards
version: v0.51.0
title: "OG image rendering restored and share-sync guard tightened"
date: 2026-02-13
published_at: 2026-02-13T15:36:57Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Fixed Open Graph image rendering crashes and prevented share-link generation from proceeding when a trip is not yet persisted."
---

## Changes
- [x] [Fixed] 🖼️ Restored `/api/og/site` and `/api/og/trip` rendering with consistent Bricolage Grotesque typography (including body text), using Satori-compatible `.woff` fallback chains and rejecting unsupported WOFF2/invalid font responses.
- [x] [Fixed] 🔤 Removed browser ellipsis fallback glyph artifacts in footer URLs by switching OG URL truncation to deterministic server-side text shortening.
- [x] [Improved] 🔗 Added a pre-share persistence check so share-link creation stops early when a trip is not synced to the database yet, avoiding backend `P0001` failures.
