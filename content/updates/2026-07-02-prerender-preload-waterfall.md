---
id: rel-2026-07-02-prerender-preload-waterfall
version: v0.141.0
title: "Pages start faster"
date: 2026-07-02
published_at: 2026-07-02T21:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Marketing pages and deep links now load noticeably faster."
---

## Changes
- [x] [Improved] ⚡ Pages now start noticeably faster — the app loads everything it needs in parallel instead of one piece at a time.
- [x] [Improved] 🔗 Opening a shared trip or profile link no longer briefly flashes the homepage before the right page appears.
- [ ] [Internal] 🧩 Prerender now injects per-route modulepreload hints (JS + locale chunks recorded during headless render) into each prerendered page's head.
- [ ] [Internal] 🔤 Default Latin font preloads moved from the JS-injected locale script to static link tags; the inline script now only handles non-default locale fonts.
- [ ] [Internal] 🧹 The inline boot-shell markup, its CSS block, and the hide-script are stripped from prerendered pages (the shell only serves non-prerendered boots).
- [ ] [Internal] 🗺️ Added dist/spa.html as the clean SPA fallback; netlify.toml and vercel.json catch-all rewrites now target it instead of the prerendered homepage.
