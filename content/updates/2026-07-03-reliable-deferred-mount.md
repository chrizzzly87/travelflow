---
id: rel-2026-07-03-reliable-deferred-mount
version: v0.150.0
title: "Footer reliably appears in Safari"
date: 2026-07-03
published_at: 2026-07-03T11:35:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Ensures the footer and below-hero sections always mount in Safari, not just most of the time."
---

## Changes
- [x] [Fixed] 🧭 The footer and below-hero sections now appear reliably on every load in Safari (previously they occasionally stayed missing on heavier pages).
- [ ] [Internal] The deferred-section/footer mount used requestIdleCallback, which WebKit/Safari throttles unreliably even with a timeout, so on heavier pages (home, features) the content sometimes never mounted. Replaced with a guaranteed setTimeout (rIC kept only as an optional earlier fast-path); reveal is idempotent.
