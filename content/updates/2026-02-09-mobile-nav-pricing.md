---
id: rel-2026-02-09-mobile-nav-pricing
version: v0.22.0
title: "Unified navigation, mobile menu, pricing page & My Trips"
date: 2026-02-09
published_at: 2026-02-09T18:00:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Consistent navigation across all pages, full mobile menu, a new Pricing page, and quick access to saved trips."
---

## Changes
- [x] [New feature] 📱 Mobile navigation menu — slide-in burger menu on all marketing and create-trip pages with all nav links and CTAs.
- [x] [New feature] 💰 New Pricing page with three-tier plan overview (Free, Casual, Globetrotter).
- [x] [New feature] 📂 "My Trips" now appears in the navigation bar when you have saved trips, opening your trip library instantly.
- [x] [Improved] 🧭 Pricing link added to desktop navigation on all pages.
- [x] [Improved] 🎨 Unified navigation bar across all pages — marketing pages and trip creation now share the same header with a subtle glass effect on the create-trip page.
- [x] [Improved] 🔒 Body scroll is locked while the mobile menu is open for a smoother experience.
- [ ] [Internal] Extracted shared SiteHeader component used by MarketingLayout and CreateTripForm.
- [ ] [Internal] Centralized navigation config for consistent links across layouts.
- [ ] [Internal] Added TripManagerContext to avoid prop drilling for trip manager access.
- [ ] [Internal] Storage service now dispatches custom events for reactive trip count updates.
