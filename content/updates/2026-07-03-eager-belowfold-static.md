---
id: rel-2026-07-03-eager-belowfold-static
version: v0.0.0
title: "Footer and sections always present"
date: 2026-07-03
published_at: 2026-07-03T15:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The footer and below-hero sections are now baked into the page so they can never be missing, in any browser."
---

## Changes
- [x] [Fixed] 🧱 The footer and below-hero sections are now part of the page's static HTML, so they are always visible immediately — even in Safari and even if the interactive layer is slow to start. This resolves the missing-footer / empty-gap reports for good.
- [ ] [Internal] Diagnosis showed production WebKit intermittently did not complete client mounting (the SiteFooter chunk was never requested on ~1/4 cold loads), so any approach that mounts below-fold content via client JS could leave it missing. Switched to rendering the deferred sections + footer eagerly on prerendered pages (isPrerenderedDocument), so they are captured as static markup and no longer depend on the client mounting to appear. First render matches capture on both sides (clean hydration); the SPA fallback still mounts them just after hydration via a guaranteed timer.
- [ ] [Internal] Trade-off: the homepage HTML is larger and LCP rises vs the lazy approach; reviving the critical-CSS inliner is the tracked follow-up to recover it. Reliability was prioritized per the incident.
