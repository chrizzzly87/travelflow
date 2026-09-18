---
id: rel-2026-09-18-offline-pwa
version: v0.175.0
title: "Install TravelFlow and open your trips offline"
date: 2026-09-18
published_at: 2026-09-18T09:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Add TravelFlow to your home screen and it opens straight to your trips — including on a plane, in a tunnel or anywhere else the signal has gone, where your saved trips still open and read exactly as they did."
---

## Changes
- [x] [New feature] 📲 Add TravelFlow to your iPhone home screen and it opens like an app — its own icon, full screen, no browser bars.
- [x] [New feature] ✈️ With no signal at all, your saved trips still open. Days, stops, times and notes read exactly as they did the last time you looked.
- [x] [New feature] 🧳 The app now opens straight to your trips, so you pick the one you are on instead of starting from the front page.
- [x] [New feature] 🗺️ The little route maps on your trip cards stay visible offline once you have seen them.
- [x] [Improved] 📶 When you are offline, the trips list says so plainly, and tells you how many of your edits are still waiting to upload.
- [x] [Improved] 🔌 Edits you make without signal keep queueing as before and go up on their own the moment you reconnect.
- [ ] [Internal] Added a generated service worker (`scripts/build-service-worker.mjs` plus `scripts/templates/sw.js`) that precaches the boot shell and caches hashed build output on first use.
- [ ] [Internal] Added `public/manifest.webmanifest` and generated 192/512/maskable install icons from the brand mark.
- [ ] [Internal] Added a `/trips` route rendering `TripManager` in a new non-modal `page` variant; the overlay keeps its dialog semantics.
- [ ] [Internal] Account API responses and Supabase traffic are explicitly never cached; only `/api/trip-map-preview` is.
- [ ] [Internal] Added a `playwright.pwa.config.ts` suite that verifies offline boot against a real production build.
