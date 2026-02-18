---
id: rel-2026-02-11-page-speed-continuous-optimization
version: v0.37.0
title: "Page speed baseline and continuous optimization"
date: 2026-02-12
published_at: 2026-02-11T16:12:40Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Improved page speed and perceived navigation with lighter initial bundles, smarter route warmups, and better progressive image delivery."
---

## Changes
- [x] [Improved] ⚡ Homepage, blog, and marketing routes now load faster with less initial JS on first visit.
- [x] [Improved] 🖼️ Progressive image loading now makes content appear sooner while reducing data usage.
- [x] [Improved] 🗺️ Example trip map previews now use smaller responsive sources to reduce over-download on cards.
- [x] [Improved] 🚀 Navigation now feels faster because likely next pages are warmed in advance.
- [x] [Improved] 🎯 Example-card interactions now keep fast direct navigation while still warming trip-view assets ahead of click.
- [x] [Fixed] 🤖 Trip/share URLs are now correctly disallowed for crawlers while public pages remain crawlable.
- [ ] [Internal] 🛠️ Resolved React warnings around progressive-image priority attributes and nested anchor markup.
- [x] [Improved] 🔤 Typography now loads more reliably via self-hosted font subsets with reduced external dependency cost.
- [x] [Improved] 🧠 Repeat visits are faster with stronger asset caching behavior.
- [ ] [Internal] 🧱 Added build-time image placeholder manifest generation (`sharp` + `blurhash`) to keep placeholder rendering deterministic.
- [ ] [Internal] 🧩 Moved simulated-login debug helpers into a lightweight standalone service to avoid pulling DB-heavy modules into unrelated routes.
- [ ] [Internal] 🎨 Deferred Prism theme CSS loading to the admin benchmark route so non-admin pages avoid render-blocking CSS.
- [ ] [Internal] 🧹 Production builds now prune `console.log/info/debug` while preserving warnings and errors.
- [ ] [Internal] 🧭 Added centralized prefetch target mapping plus queue/budget/network guardrails to keep prefetching effective without overfetching.
- [ ] [Internal] 🧪 Added live navigation-prefetch diagnostics to the on-page debugger for attempts/completions/skip-reason visibility.
- [ ] [Internal] 🧰 Made Navigation Prefetch and View Transition debugger cards collapsible (persisted state), added inline info tooltips, and added an optional overlay that highlights links when prefetch is triggered.
- [ ] [Internal] 📋 Continued documenting performance and transition guardrails in backlog/docs to prevent regressions during UX iteration.
- [x] [Improved] ⏱️ First-load now prioritizes rendering and interaction before background route warmup starts.
- [x] [Improved] ⚡ Homepage startup now ships less JavaScript before the page becomes interactive.
- [ ] [Internal] 🧭 Added a shared warmup gate so speculative rules and route prefetch stay deferred until idle or first interaction.
- [ ] [Internal] 🗂️ Added a dedicated performance execution checklist with baseline metrics and step-by-step continuation tasks.
- [ ] [Internal] 🧩 Moved trip/share/example route loaders out of `App.tsx` into a lazy route-loader module to reduce entry-graph weight.
- [ ] [Internal] 🔌 Split DB wrappers into a shared API layer and switched DB capability checks to env-only evaluation so Supabase runtime code is not pulled in eagerly.
- [ ] [Internal] 🔐 Deferred auth modal and auth-service loading so authentication bundles are fetched only when the auth flow is actually needed.
- [ ] [Internal] 🎛️ Disabled build-time asset inlining so flag assets emit as separate SVG files instead of inflating the entry CSS bundle.
- [ ] [Internal] 🗂️ Extracted route-table and fallback route-warmup concerns into dedicated `app/routes/*` and `app/prefetch/*` modules to keep `App.tsx` smaller and preload logic single-sourced.
- [ ] [Internal] 🧱 Extracted startup bootstrap hooks (`warmup`, debugger wiring, analytics init, auth return-path memory) into `app/bootstrap/*` to further simplify `App.tsx` orchestration.
- [ ] [Internal] 🪟 Gated heavy plane-window hero media to desktop-only rendering so mobile home loads avoid large hidden-image downloads.
- [ ] [Internal] 🧪 Added route-level Lighthouse checks for `/`, `/create-trip`, and `/trip/:id` and used the results to remove eager home carousel `TripView` prewarm from first render.
- [ ] [Internal] 🧭 Replaced header locale selection with a lightweight native control and lazy-loaded account/mobile header menus so they do not load on first paint.
- [ ] [Internal] 🏳️ Replaced global flagpack CSS usage with emoji-based flag rendering to remove heavy flag stylesheet payload from initial page load.
- [ ] [Internal] 🛡️ Deferred admin navigation metadata loading in the shared mobile menu so non-admin sessions no longer pay the admin-config parsing cost.
- [ ] [Internal] 🧱 Extracted app-level provider composition into `app/bootstrap/AppProviderShell.tsx` to keep root bootstrap responsibilities isolated from app orchestration logic.
- [ ] [Internal] 💤 Removed idle route warmups from homepage and create-trip entry paths so first-load bandwidth is reserved for currently visible UI.
- [ ] [Internal] 👀 Deferred homepage example-carousel code/data loading until the section enters the viewport, preserving layout with a fixed-height placeholder.
- [ ] [Internal] 🧩 Moved app runtime helpers from the monolithic utility module into a focused runtime service used by root app bootstrap.
- [ ] [Internal] 📦 Disabled Vite module-preload dependency fan-out to keep entry execution on-demand and reduce first-load JavaScript on entry routes.
- [ ] [Internal] 🪟 Gated login-modal rendering to open-state only so auth modal code is not fetched during initial page render.
