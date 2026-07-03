---
id: rel-2026-07-03-fix-webkit-belowfold
version: v0.0.0
title: "Full page content loads in Safari"
date: 2026-07-03
published_at: 2026-07-03T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Fixes the footer and below-the-hero sections not appearing in Safari, which left a large empty gap on landing pages."
---

## Changes
- [x] [Fixed] 🧭 Landing pages now show the footer and all below-the-hero sections in Safari — previously they could stay empty, leaving a large gap under the page.
- [ ] [Internal] Below-fold marketing sections and the footer were gated on IntersectionObserver, whose callbacks did not fire for these elements in WebKit/Safari, so the lazy content never mounted. Replaced the IO gate with a one-shot idle-callback mount right after hydration (with a setTimeout fallback), which is reliable across browsers and still keeps the hero's first paint unblocked. First render keeps the empty spacers, matching prerendered markup for clean hydration.
