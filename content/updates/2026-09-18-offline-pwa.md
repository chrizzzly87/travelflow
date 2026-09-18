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
- [x] [Improved] 📶 When you are offline, the trips list says so plainly at the top of the screen, so an empty-looking list explains itself.
- [x] [Improved] 🔑 If you are signed out, the trips list now tells you, with a way to sign in — adding the app to your home screen starts a fresh sign-in, so your trips are not gone, just not loaded yet.
- [x] [Improved] 🔌 Edits you make without signal keep queueing as before and go up on their own the moment you reconnect.
- [ ] [Internal] Added a generated service worker (`scripts/build-service-worker.mjs` plus `scripts/templates/sw.js`) that precaches the boot shell and caches hashed build output on first use.
- [ ] [Internal] Added `public/manifest.webmanifest` and generated 192/512/maskable install icons from the brand mark.
- [ ] [Internal] Added a `/trips` route rendering `TripManager` in a new non-modal `page` variant; the overlay keeps its dialog semantics.
- [ ] [Internal] Account API responses and Supabase traffic are explicitly never cached; only `/api/trip-map-preview` is.
- [ ] [Internal] Added a `playwright.pwa.config.ts` suite that verifies offline boot against a real production build.
- [ ] [Internal] `/trips` renders the shared `ConnectivityStatusBanner` and a signed-out notice gated on `isAuthLoading`, covered by `tests/browser/tripsRouteSignedOutNotice.browser.test.ts`.
- [ ] [Internal] Localized the trips list's own strings (search field, empty state, no-matches); they were hardcoded English and showed through on a localized page.
- [ ] [Internal] `/trips` is registered in `pageTitleService`; it previously fell through to the 404 label, so the installed app's start page opened titled "404".
- [ ] [Internal] Netlify now serves `/manifest.webmanifest` as `application/manifest+json`; it inferred `application/octet-stream`, which iOS can refuse when judging installability.
