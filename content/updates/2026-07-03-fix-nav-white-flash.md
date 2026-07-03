---
id: rel-2026-07-03-fix-nav-white-flash
version: v0.0.0
title: "No more white flash between pages"
date: 2026-07-03
published_at: 2026-07-03T08:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Switching between pages no longer flashes a blank white screen."
---

## Changes
- [x] [Fixed] ⚡ Switching between pages no longer flashes a blank white screen while the next page loads.
- [ ] [Internal] The prerender boot-shell strip removed the inline `<style data-tf-boot-shell-css>` block, but the runtime `AppBootstrapShell` (MarketingRouteLoadingShell Suspense fallback during client-side navigation) reuses those `tf-boot-*` classes and they exist nowhere else — leaving the navigation fallback unstyled (full-screen white). Prerender now keeps the style block and still strips the redundant shell markup + hide-script.
- [ ] [Internal] Regression coverage in prerenderHtmlUtils asserts the boot-shell style survives while markup/script are removed.
