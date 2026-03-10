---
id: rel-2026-03-09-blog-transition-merge-followup
version: v0.0.0
title: "Blog transition merge follow-up"
date: 2026-03-09
published_at: 2026-03-09T20:45:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Refines the merged blog view-transition geometry and adds simpler Safari-friendly fallbacks so blog transitions stay visible even when nested View Transitions features are unavailable."
---

## Changes
- [x] [Improved] 🖼️ Blog list and detail images now share calmer card/hero geometry again so the transition no longer picks up the extra scale drift from hover-state transforms.
- [x] [Improved] 🧭 Blog article opens now keep a clearer shared transition on browsers that support basic View Transitions but not the newer nested grouping APIs, including Safari-friendly fallback behavior.
- [ ] [Internal] 🧭 Audited the merged GH-109 blog transition files, restored the stable card and hero image frames, and revalidated the merged flow with build, tests, and browser checks.
- [ ] [Internal] 🧪 Split the blog transition support checks between base shared-element support and richer nested/class support so unsupported browsers can fall back cleanly instead of losing the effect.
