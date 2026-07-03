---
id: rel-2026-07-03-fix-cold-load-hydration
version: v0.146.0
title: "Landing pages load complete on first paint"
date: 2026-07-03
published_at: 2026-07-03T07:23:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Cold-loading a page now shows images, banners, and the active nav immediately instead of a stripped-down page until you click around."
---

## Changes
- [x] [Fixed] 🖼️ Opening a page directly (blog, inspirations, homepage, features) now shows card images, the language banner, and the active navigation right away — no more waiting for the app to "wake up" after the first click.
- [x] [Improved] ⚡ Landing pages become interactive about three times sooner on a cold load.
- [ ] [Internal] Removed the pre-mount warmup gate in index.tsx that deferred hydration several seconds; hydration now runs immediately (prerendered DOM stays on screen and does not blank while i18n loads).
- [ ] [Internal] Prerender now loads images through a sharp-backed emulation of the Netlify image CDN (honouring fm/w/q), so blog/inspiration cards are captured with real images + blurhash instead of their error-fallback state.
- [ ] [Internal] Blog/inspiration cards render their picture on prerendered pages regardless of a transient capture error (isPrerenderedDocument), matching the client's first hydration render.
- [ ] [Internal] Below-fold marketing sections + footer stay IntersectionObserver-gated on both prerender and client (eager rendering regressed LCP); documented the prerender/hydration invariants in LIGHTHOUSE.md.
