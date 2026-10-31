---
id: rel-2026-10-31-start-migration-cleanup
version: v0.212.0
title: "Post-migration cleanup"
date: 2026-10-31
published_at: 2026-10-31T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Removed leftover pre-migration files and unused dependencies, and moved every animation onto one library."
---

## Changes
- [ ] [Internal] 🧹 Deleted the leftover Vercel config, the `App.tsx` re-export, the unused admin access page and trip route loader module, and stray scratch files left from before the TanStack Start migration.
- [ ] [Internal] 📦 Removed the never-imported `i18next-browser-languagedetector`, `@radix-ui/react-use-controllable-state`, `terser` and `i18next-icu` packages, and moved `@types/google.maps` to dev dependencies.
- [ ] [Internal] 🎞️ The recommendation swipe deck and the floating trip map preview now use `motion/react`, so `framer-motion` is gone and the app ships a single animation library.
- [ ] [Internal] 🧪 The terms-guard unit test imports the terms policy module directly, and the storage registry validator scans the `app/` shell instead of the deleted entry file.
- [ ] [Internal] 📝 Corrected a stale Netlify config comment that still described the old SPA fallback.
