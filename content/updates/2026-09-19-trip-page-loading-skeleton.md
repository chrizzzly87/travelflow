---
id: rel-2026-09-19-trip-page-loading-skeleton
version: v0.181.0
title: "Opening a trip no longer starts with a blank page"
date: 2026-09-19
published_at: 2026-09-19T16:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The placeholder you see while a trip opens now has the shape of the trip page itself — the day ruler, the cities, the transfers and the map are already in their places, so the planner settles into view instead of snapping into it."
---

## Changes
- [x] [Improved] 🦴 Opening a trip now shows the shape of the trip page while it loads. Instead of a centred card that looked nothing like the planner, you see the day ruler, the row of cities, the transfers between them and the map pane already sitting where they belong — so when the trip arrives it settles into place rather than replacing something else.
- [x] [Improved] 🌗 The loading placeholder is much calmer to look at. The old shimmer swept every block in lockstep at a hard contrast; the new one is a soft pass with a pause between each sweep, and it respects the reduce-motion setting on your device.
- [x] [Improved] 🧭 If you last had the map beside your timeline, the placeholder shows it beside your timeline — and the same for the map-on-top layout, including the pane widths you dragged. Your planner opens the way you left it, from the very first frame.
- [x] [Fixed] ⚡ Trips that open quickly no longer flash a placeholder at you. The skeleton now waits a moment before appearing, so a fast load goes straight to your itinerary.
- [ ] [Internal] 📐 Rebuilt the trip half of `AppBootstrapShell` against measured geometry from a live example trip at 1440×900: 76px header, 32px left gutter, 48px day columns, month band 0–31, day ruler 31–78, city row at 138 (h60, r8, 2px border), transfer chips at 250 (54×40), activity cards at 396 (48 wide, r10). Verified by probing `.tf-boot-planner` in the running app during the Suspense window; every landmark lands on the real planner's offset.
- [ ] [Internal] 🎞️ Replaced the `background-position` shimmer with a `.tf-bone` pseudo-element on a `translate3d` sweep (2.4s, 58% travel + hold, `--tf-bone-phase` for stagger) — the old one repainted a 200%-wide gradient per frame on the main thread. 26 animated bones total; the map pane and the white transfer chips stay static on purpose. A single blended `mix-blend-mode: screen` band over the whole pane was tried first and rejected: it lifted the hairlines and borders too, so the structure dissolved mid-sweep.
- [ ] [Internal] ⏱️ `.tf-boot-planner` fades in via `animation: … 150ms both`, which holds it at `opacity: 0` through the delay rather than rendering and then hiding it.
- [ ] [Internal] 🗺️ `TripRouteLoadingShell` reads `readPersistedTripViewSettings()` directly in render (no hook — it is a Suspense fallback, and `React.useState` on the namespace import throws under `preact/compat` here) and passes `layoutMode` / `sidebarWidth` / `timelineHeight` down as `data-tf-boot-layout` and CSS custom properties.
- [ ] [Internal] 🧹 Dropped the dead trip-body rules (`tf-boot-page--trip`, `tf-boot-trip-summary`, `tf-boot-trip-canvas`, `tf-boot-card`, `tf-boot-metric`, `tf-boot-surface`) and the `tf-boot-shimmer` keyframes; marketing chrome bones now share `.tf-bone`. Coverage in `tests/browser/tripview/tripRouteLoadingShell.browser.test.ts`; `tests/unit/indexBootstrapShell.test.ts` updated for the new class strings.
