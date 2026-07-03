---
id: rel-2026-07-03-fix-hydration-first-render-match
version: v0.0.0
title: "Reliable landing-page loads across browsers"
date: 2026-07-03
published_at: 2026-07-03T13:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Fixes the intermittent broken landing-page load (missing footer/sections, occasional blank) across Chrome and Safari."
---

## Changes
- [x] [Fixed] 🧩 Landing pages now load reliably and completely in every browser — the intermittent broken state (missing footer and below-hero sections, occasional blank page) is resolved, in both Chrome and Safari.
- [ ] [Internal] Root cause was preact/compat hydration (not React 18): when the first client render suspended (async i18n above the route Suspense boundary) or diverged from the prerendered markup (deferred sections rendered as empty spacers while the capture held full content), preact tore the tree down — blanking to the root `fallback={null}` or dropping the footer. Fixes: (1) await the app-shell i18n namespaces before hydrating (bounded timeout) so the first render never suspends on translations; (2) the root Suspense fallback now renders the boot-shell skeleton (never blank) and carries the handoff marker; (3) deferred marketing sections + footer render as empty spacers on BOTH the prerender capture and the client's first render, then mount right after hydration via an idle callback (never IntersectionObserver, whose callbacks did not fire in WebKit/Safari), so hydration matches exactly and content still appears reliably.
- [ ] [Internal] Documented preact/compat hydration invariants (first render must match capture and must not suspend at the root) in LIGHTHOUSE.md.
