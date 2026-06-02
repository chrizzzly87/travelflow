---
id: rel-2026-06-02-astro-marketing-performance-migration
version: v0.122.0
title: "Astro marketing performance migration"
date: 2026-06-02
published_at: 2026-06-02T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Marketing and content pages are moving to static Astro output for faster first loads and cleaner app boundaries."
---

## Changes
- [x] [Improved] ⚡ Marketing and content pages now load from static pages first, keeping the trip planner app bundle out of the initial visit.
- [x] [Improved] 🧭 Public pages keep the same clean URLs while app-only routes continue opening the full planner experience.
- [ ] [Internal] 🏗️ Added a shared marketing route manifest for Astro generation, sitemap output, and deployment routing.
- [ ] [Internal] 🧪 Expanded Lighthouse audits with a 95+ mobile performance target for key marketing routes.
- [ ] [Internal] 📦 Added the Astro and Preact static marketing build pipeline alongside the existing Vite app build.
