---
id: rel-2026-02-11-page-speed-continuous-optimization
version: v0.46.0
title: "Page speed baseline and continuous optimization"
date: 2026-02-12
published_at: 2026-02-12T15:18:56Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Improved page speed and perceived navigation with lighter initial bundles, smarter route warmups, and better progressive image delivery."
---

## Changes
- [x] [Improved] ⚡ Homepage, blog, and marketing routes now load faster with less initial JS on first visit.
- [x] [Improved] 🖼️ Progressive BlurHash placeholders and production Netlify Image CDN delivery now make content imagery appear faster and transfer fewer bytes.
- [x] [Improved] 🗺️ Example trip map previews now use smaller responsive sources to reduce over-download on cards.
- [x] [Improved] 🚀 Navigation now prewarms likely next routes (hover/focus/touch/viewport/idle) and uses Speculation Rules prefetch hints for quicker follow-up page opens.
- [x] [Improved] 🎯 Example-card interactions now keep fast direct navigation while still warming trip-view assets ahead of click.
- [x] [Fixed] 🤖 Trip/share URLs are now correctly disallowed for crawlers while public pages remain crawlable.
- [x] [Fixed] 🛠️ React warnings were resolved for progressive image `fetchpriority` attributes and nested anchor markup.
- [x] [Improved] 🔤 Typography now loads more reliably via self-hosted font subsets with reduced external dependency cost.
- [x] [Improved] 🧠 Hashed `/assets/*` files now ship with immutable cache headers for stronger repeat-visit performance.
- [ ] [Internal] 🧱 Added build-time image placeholder manifest generation (`sharp` + `blurhash`) to keep placeholder rendering deterministic.
- [ ] [Internal] 🧩 Moved simulated-login debug helpers into a lightweight standalone service to avoid pulling DB-heavy modules into unrelated routes.
- [ ] [Internal] 🎨 Deferred Prism theme CSS loading to the admin benchmark route so non-admin pages avoid render-blocking CSS.
- [ ] [Internal] 🧹 Production builds now prune `console.log/info/debug` while preserving warnings and errors.
- [ ] [Internal] 🧭 Added centralized prefetch target mapping plus queue/budget/network guardrails to keep prefetching effective without overfetching.
- [ ] [Internal] 🧪 Added live navigation-prefetch diagnostics to the on-page debugger for attempts/completions/skip-reason visibility.
- [ ] [Internal] 🧰 Made Navigation Prefetch and View Transition debugger cards collapsible (persisted state), added inline info tooltips, and added an optional overlay that highlights links when prefetch is triggered.
- [ ] [Internal] 📋 Continued documenting performance and transition guardrails in backlog/docs to prevent regressions during UX iteration.
