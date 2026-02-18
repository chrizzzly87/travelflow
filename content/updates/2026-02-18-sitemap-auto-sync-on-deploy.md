---
id: rel-2026-02-18-sitemap-auto-sync-on-deploy
version: v0.51.0
title: "Sitemap auto-sync on deployment"
date: 2026-02-18
published_at: 2026-02-18T21:15:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Sitemap generation now reads live route and locale sources so each deployment publishes an up-to-date sitemap automatically."
---

## Changes
- [x] [Improved] 🗺️ Search engines now get a refreshed sitemap on each deployment with the latest public pages.
- [ ] [Internal] 🔄 Sitemap generation now reads route and locale sources directly and excludes utility/error routes from indexing.
