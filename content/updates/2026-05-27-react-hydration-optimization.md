---
id: rel-2026-05-27-react-hydration-optimization
version: v0.120.0
title: "React hydration and pre-rendering optimization for marketing routes"
date: 2026-05-27
published_at: 2026-05-27T14:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Implemented build-time pre-rendering for key marketing pages and enabled React 18 hydration with cleaner route delivery."
---

## Changes
- [x] [Improved] ⚡ Marketing pages now lazy load and progressively hydrate below-the-fold components on scroll.
- [x] [Fixed] 🧭 Pre-rendered pages now avoid hydration mismatch console errors during performance audits.
- [x] [Improved] 🏎️ Marketing pages are pre-rendered for faster first paint without changing clean route URLs.
- [x] [Improved] ✨ Top page notices now appear immediately below the navigation without shifting page content after interaction.
- [ ] [Internal] 🧱 Added an opt-in critical CSS evaluation path while keeping it disabled by default after Lighthouse regression checks.
- [ ] [Internal] ⚙️ Added comprehensive developer guidelines for above-the-fold optimizations and progressive hydration.
- [ ] [Internal] 📚 Documented generalized performance guardrails for hydration timing, pre-render viewport sizing, and mobile Lighthouse validation.
- [ ] [Internal] 🛠️ Hardened the pre-render browser launch for hosted Linux build environments.
- [ ] [Internal] 🧪 Made hosted pre-render builds install the required Playwright browser binary when it is missing.
- [ ] [Internal] 🧯 Hardened pre-rendered marketing hydration for returning browsers with stored banner, locale, or auth state.
