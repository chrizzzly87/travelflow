---
id: rel-2026-07-05-nextjs-migration
version: v0.154.0
title: "Faster pages on a new foundation"
date: 2026-07-05
published_at: 2026-07-05T18:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Every page now loads faster and in your language from the first moment, on a rebuilt technical foundation."
---

## Changes
- [x] [Improved] ⚡ Pages now arrive fully rendered from the server, so content appears faster and never loads half-finished.
- [x] [Improved] 🌍 Translated pages ship in your language from the very first moment — no more brief English flashes.
- [x] [Improved] 🧭 The navigation highlights your current page correctly right from page load.
- [x] [Fixed] 🔗 Addresses that don't exist now show the correct "not found" page immediately.
- [ ] [Internal] Migrated the entire app from a Vite SPA (preact/compat + react-router + custom Playwright prerender) to Next.js App Router on React 19.
- [ ] [Internal] Removed the prerender/hydration workaround machinery (boot shell, modulepreload injection, spa.html fallback, two-pass rendering flags) — structurally resolved by server rendering.
- [ ] [Internal] Router compat layer (lib/router) on next/navigation; react-router-dom, preact, terser, critical, three removed from the dependency tree.
- [ ] [Internal] i18next now initializes per-locale on the server; translations are embedded in the prerendered HTML for all 11 locales.
- [ ] [Internal] Env vars renamed import.meta.env.VITE_* → process.env.NEXT_PUBLIC_* (deployment env still accepts VITE_* via next.config mapping).
