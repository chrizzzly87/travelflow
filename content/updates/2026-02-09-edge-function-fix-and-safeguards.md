---
id: rel-2026-02-09-edge-function-fix-and-safeguards
version: v0.28.0
title: "Edge function stability fix"
date: 2026-02-09
published_at: 2026-02-09T22:35:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Fixed a deployment issue that caused 500 errors on all pages, and added build-time safeguards to prevent it from happening again."
---

## Changes
- [x] [Fixed] 🛡️ Resolved a deployment issue that caused every page to return 500 Internal Server Error.
- [ ] [Internal] Removed inline `export const config` from trip-map-preview edge function — mixed config styles crash the Netlify edge bundle.
- [ ] [Internal] Added build-time edge function validator (`npm run edge:validate`) that blocks deploys using inline route config.
- [ ] [Internal] Validator also warns about orphaned function files and broken netlify.toml references.
- [ ] [Internal] Created comprehensive edge function documentation (`docs/EDGE_FUNCTIONS.md`) covering architecture, routes, env vars, caching, and failure modes.
- [ ] [Internal] Removed accidentally restored `_backup/` directory.
- [x] [Improved] 🖼️ Open Graph images now scale headlines dynamically — long blog and page titles fit cleanly instead of overflowing.
- [ ] [Internal] Improved blog post OG meta descriptions for better search and social previews.
