---
id: rel-2026-03-10-homepage-pagespeed-pass
version: v0.96.0
title: "Homepage loads lighter and repeat visits feel faster"
date: 2026-03-17
published_at: 2026-03-17T14:52:55Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Cuts homepage transfer weight and keeps public marketing pages warmer at the edge so the first visit stays lighter and repeat visits come back faster."
---

## Changes
- [x] [Improved] 🛫 The homepage hero now loads its decorative airplane artwork in production-friendly responsive formats, cutting the first desktop payload without changing the layout.
- [x] [Improved] 🗺️ Example trip previews on the homepage now use optimized production image delivery instead of full-size source images, so the examples section is much lighter when it appears.
- [x] [Improved] ⚡ Public marketing pages now stay warmer at the edge cache, so repeat visits can load faster without making the planner experience stale.
- [ ] [Internal] 📊 Captured before-and-after homepage Lighthouse baselines for desktop and mobile so follow-up chunk work can target the remaining shared JavaScript cost with real measurements.
- [ ] [Internal] 🧯 Added a guard that suppresses idle route warmups during first-load-critical handoff so homepage Lighthouse runs avoid non-essential prefetch work in the first render window.
- [ ] [Internal] 🌍 Documented the optional EU-west Netlify Functions alignment step for plans that expose custom regions and kept broad module preloading disabled after rechecking the first-load dependency fanout.
