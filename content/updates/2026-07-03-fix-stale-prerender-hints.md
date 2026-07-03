---
id: rel-2026-07-03-fix-stale-prerender-hints
version: v0.147.0
title: "Landing pages fully interactive on load"
date: 2026-07-03
published_at: 2026-07-03T08:06:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Fixes landing pages loading in a half-working state (missing images, footer, banners, active nav) until you clicked to another page."
---

## Changes
- [x] [Fixed] 🧩 Landing pages now become fully interactive on first load — the active navigation, card images, footer, cookie/language banners and the features globe all appear without needing to click to another page first.
- [x] [Fixed] 🖼️ Card images always reveal even when they load from cache faster than the page finishes starting up (previously they could stay stuck on the blurred placeholder).
- [ ] [Internal] Root cause: the prerender step could attach to a stale leftover preview server, baking modulepreload hints that referenced chunk hashes absent from the deployed build; those requests fell through to the SPA-fallback HTML (text/html), failed MIME checks, and broke hydration. Hardened: prerender aborts if its port is occupied, uses --strictPort, and only emits hints for chunks present in the build.
- [ ] [Internal] Added a build-time safety gate that fails the prerender if any generated page references a JS asset missing from the build (prevents shipping a dangling-chunk regression).
- [ ] [Internal] Defined distDir in the prerender main() scope (was only in the critical-CSS helper), which had silently disabled the image-CDN proxy during capture.
- [ ] [Internal] ProgressiveImage reconciles image load state from the DOM on mount (img.complete) so a load event that fires before hydration no longer leaves the image hidden.
