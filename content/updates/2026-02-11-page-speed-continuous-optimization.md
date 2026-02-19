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
- [ ] [Internal] 🔐 Switched auth bootstrap on non-critical marketing routes to interaction-triggered loading so auth bundles are not fetched during homepage first render.
- [ ] [Internal] 🧱 Split destination catalog/search logic into a dedicated service and moved prefill decoding out of `utils` so the shared utility bundle is substantially smaller.
- [ ] [Internal] 🧭 Suppressed passive (viewport/hover/focus) route prefetch on first-load-critical paths while keeping click/touch-triggered warmups.
- [ ] [Internal] 🧭 Added a shared first-load-critical route matcher and used it to disable speculation-rules mounting on `/`, `/create-trip`, `/trip`, and `/example` during initial load.
- [ ] [Internal] 🔌 Migrated `TripView` database operations to `dbApi` wrappers so Supabase runtime modules are no longer statically imported in trip-route chunks.
- [ ] [Internal] 🤖 Deferred trip-side AI helper imports so the heavy AI runtime bundle loads only when AI enhancement actions are used.
- [ ] [Internal] 🗞️ Moved trip release-notice markdown rendering into a lazy chunk and deferred it until interaction/idle so initial trip loading stays lighter.
- [ ] [Internal] 📝 Deferred markdown editor and print layout code so trip entry loads only planner essentials on first render.
- [ ] [Internal] 🧩 Deferred trip detail panels so selection/editing bundles load only after users focus a timeline item.
- [ ] [Internal] 📱 Deferred mobile details drawer code until panel open-state so mobile trip entry keeps less UI runtime upfront.
- [ ] [Internal] 🔧 Replaced the trip admin edit toggle with a native control to remove remaining Radix switch runtime from first-load trip bundles.
- [ ] [Internal] ➕ Deferred add-city/add-activity modal bundles until users open those planners, reducing initial trip JS work.
- [ ] [Internal] 🌍 Deferred destination info panel code until the trip-info overlay is opened, trimming initial trip bundle weight.
- [ ] [Internal] 🔗 Deferred trip sharing dialog code until users open share controls, keeping initial planner bundles leaner.
- [ ] [Internal] 🕘 Deferred trip history dialog code until users open history, reducing default planner bundle scope.
- [ ] [Internal] 🧾 Deferred trip-info modal shell code until users open trip information, shrinking initial planner payload.
- [ ] [Internal] 📉 Deferred the non-default vertical timeline bundle so default trip loads avoid shipping both timeline variants upfront.
- [ ] [Internal] 🧭 Stopped loading heavy example-card datasets during example-trip hydration by using lightweight template metadata in the route loader.
- [ ] [Internal] 🧩 Split example-template factory loading into per-template dynamic imports so example-trip entry routes avoid fetching the monolithic template index on first render.
- [ ] [Internal] 🌐 Reworked i18n startup to use lightweight in-app locale detection and interpolation config so first-load entry JavaScript stays smaller on homepage and trip entry routes.
