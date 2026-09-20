---
id: rel-2026-09-20-dark-mode-and-plane-window
version: v0.185.0
title: "Dark mode, and a window seat on the homepage"
date: 2026-09-20
published_at: 2026-09-20T18:30:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "TravelFlow now has a full dark mode you can switch from any page, and the homepage window looks out over drifting clouds you can shut the blind on."
---

## Changes
- [x] [New feature] 🌙 Dark mode across the whole app, with a switch in the menu on desktop and mobile. Your choice is remembered, and leaving it alone simply follows your device.
- [x] [New feature] ☁️ The homepage window now looks out over clouds that drift past at different depths, so the view never repeats.
- [x] [New feature] 🪟 Pull the window blind down to bring on dark mode, and slide it back up for light. The page dims with your hand as you drag.
- [x] [Improved] 🎨 A more saturated accent colour throughout, and colours chosen to stay readable in both themes.
- [x] [Fixed] 🔁 The clouds behind the window no longer jump every few seconds.
- [x] [Fixed] ⚡ Opening a page directly no longer briefly shows pieces of the homepage, which could leave headings off-centre until everything finished loading.
- [x] [Fixed] 🔆 The logo no longer flashes while a page loads.
- [x] [Fixed] 🗺️ The country map, the activity badges and the release notes all stay legible in dark mode instead of washing out.
- [ ] [Internal] Replaced the scrolling cloud strip with an imperative three.js scene ported from drei's instanced cloud billboards. react-three-fiber cannot be used here: React is aliased to preact/compat, which has no react-reconciler, so R3F mounts a canvas and silently never attaches a renderer.
- [ ] [Internal] Converted light-only utilities to semantic tokens across ~190 files, including families earlier passes could not see: arbitrary variant prefixes, gradient stops, `divide-*`, tinted callouts, Tailwind Typography and class strings held in `.ts` files.
- [ ] [Internal] Activity-type colours are now named palette tokens defined once for both themes, with solid values so overlapping badges do not darken where they stack.
- [ ] [Internal] Prerenderer no longer writes the homepage into dist/index.html mid-run, which had made it the SPA fallback for every later route and contaminated their HTML.
- [ ] [Internal] Added `pnpm darkmode:audit`, which crawls the built app and fails on light surfaces or text below WCAG AA.
- [ ] [Internal] Theme state reads through useSyncExternalStore; an inline pre-paint script applies the theme before prerendered markup is shown.
