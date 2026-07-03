---
id: rel-2026-07-03-nav-active-underline
version: v0.153.0
title: "Current page is highlighted in the nav"
date: 2026-07-03
published_at: 2026-07-03T15:17:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "The active navigation item is now underlined immediately on load, not only after switching pages."
---

## Changes
- [x] [Fixed] 🧭 The navigation now highlights the page you're on right away when you open it directly — previously the underline only appeared after switching to another page.
- [ ] [Internal] The active state was derived on the first render, but preact/compat does not reconcile a className that differs only between the prerendered DOM and the first client render during hydration, so the DOM stayed stuck inactive. Fixed with the two-pass pattern: render inactive first (matching the prerendered markup), then derive the active link from window.location after a hydration flag flips — a real post-hydration change preact applies. Updates correctly on client navigation.
