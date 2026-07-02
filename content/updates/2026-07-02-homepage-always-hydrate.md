---
id: rel-2026-07-02-homepage-always-hydrate
version: v0.0.0
title: "Faster homepage first paint"
date: 2026-07-02
published_at: 2026-07-02T21:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Landing pages now stay visible while the app finishes loading instead of flashing blank."
---

## Changes
- [x] [Improved] ⚡ Landing pages no longer flash blank while the app finishes loading — the page stays visible from the first moment, also for returning visitors.
- [x] [Improved] 🧹 Removed the early-preview banner from the top of the site.
- [ ] [Internal] Removed the personalized-storage hydration bail-out in reactRootRenderMode; prerendered markup is now always hydrated.
- [ ] [Internal] index.tsx warms critical route modules and app-shell i18n namespaces (bounded by a 2.5s timeout) before mounting so the first render commits without suspending into the blank root fallback.
- [ ] [Internal] EarlyAccessBanner component, its locale keys, cookie-policy entry, and browser test removed; TranslationNoticeBanner now owns its dismiss label.
