---
id: rel-2026-03-10-homepage-pagespeed-pass
version: v0.0.0
title: "Homepage media now ships through the production image pipeline"
date: 2026-03-10
published_at: 2026-03-10T14:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Reduced homepage transfer weight by sending the hero artwork and example trip maps through the production image pipeline instead of the full original PNGs."
---

## Changes
- [x] [Improved] 🛫 The homepage hero now loads its decorative airplane artwork in production-friendly responsive formats, cutting the first desktop payload without changing the layout.
- [x] [Improved] 🗺️ Example trip previews on the homepage now use optimized production image delivery instead of full-size source images, so the examples section is much lighter when it appears.
- [ ] [Internal] 📊 Captured before-and-after homepage Lighthouse baselines for desktop and mobile so follow-up chunk work can target the remaining shared JavaScript cost with real measurements.
- [ ] [Internal] 🧯 Added a guard that suppresses idle route warmups during first-load-critical handoff so homepage Lighthouse runs avoid non-essential prefetch work in the first render window.
