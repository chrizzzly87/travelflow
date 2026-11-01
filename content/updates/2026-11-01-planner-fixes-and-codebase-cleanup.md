---
id: rel-2026-11-01-planner-fixes-and-codebase-cleanup
version: v0.216.0
title: "Planner fixes and a tidier codebase"
date: 2026-11-01
published_at: 2026-11-01T15:28:08Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Signing in from the planner keeps the trip details you entered, and the traveler counters now work with screen readers."
---

## Changes
- [x] [Fixed] 🔐 When the planner asks you to sign in before generating, you now come back to the form with the details you had entered, not the ones it first opened with.
- [x] [Improved] 🔊 Screen readers now name each plus and minus button when you set group size, adults, children, babies or flexible weeks, and read out the new number after every change.
- [ ] [Internal] 🧾 Trip and create routes declare lenient typed `validateSearch` schemas (plain functions, no validation library in the landing preload) and read the route's validated search instead of `location.search` or `window.location`.
- [ ] [Internal] ✍️ View-settings and planner prefill URL syncs write through `useRouteSearchWriter` (router `navigate` with `replace`) instead of `history.replaceState`, skipping no-op writes and writes from a page being left (#586); the remaining `window.location.assign` calls are documented full reloads.
- [ ] [Internal] 🧩 One shared create-trip `NumberStepper` replaces the two page copies, and the classic create page module dropped its old "lab" name; the URL is unchanged.
- [ ] [Internal] 🗂️ Split `services/dbService.ts` into `services/db/*` domain modules and the root `utils.ts` into focused `shared/` and `utils/` modules, both behind re-export barrels with unchanged public names and the database code still in its own lazy chunk.
- [ ] [Internal] 🗺️ Moved the itinerary map's pure helpers (route cache, attempt policy, marker tiers and HTML, Mapbox layer config) into `components/maps/*` modules with unit tests, and deleted the stale test-only copy in `itineraryMapUtils.tsx`.
- [ ] [Internal] 🕰️ Admin screens share one relative-time formatter, one detail-field component and one relative-timestamp component; trip times under a minute now read "just now".
- [ ] [Internal] 🧹 Removed pre-migration leftovers (`vercel.json`, `App.tsx`, the unused admin access page and trip loader barrel, stray scratch files) and unused packages (`i18next-browser-languagedetector`, `@radix-ui/react-use-controllable-state`, `terser`, `i18next-icu`); `framer-motion` is replaced by `motion/react`.
- [ ] [Internal] 📚 Refreshed the README and docs for the TanStack Start stack, merged the Netlify guides, and moved completed plans and research into `docs/archive/`.
- [ ] [Internal] 🧪 Pinned GitHub runners to `ubuntu-24.04` (Playwright cannot install browsers on 26.04), steadied the admin telemetry table test, and pinned the clock in the seasonal create-trip recommendation test.
