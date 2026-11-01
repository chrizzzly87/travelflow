---
id: rel-2026-10-31-typed-search-params
version: v0.212.0
title: "Typed search params and router-owned URL writes"
date: 2026-10-31
published_at: 2026-10-31T19:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Trip and planner pages now read and update their web address through the app's router, so a sign-in from the planner keeps the trip details you entered."
---

## Changes
- [x] [Fix] 🔐 When the planner asks you to sign in before generating, you now come back to the form with the details you had entered, not the ones it first opened with.
- [ ] [Internal] 🧾 The trip area (`v`, `claim`, `claim_conflict`, `discover`, `mode` and the view-setting keys) and the create area (`prefill`) declare lenient typed `validateSearch` schemas (plain functions, so the landing pages do not preload a validation library): no defaults are added, unknown parameters are kept, and invalid values read as absent instead of throwing.
- [ ] [Internal] 🧭 TripView, the trip workspace, route view settings and both create pages read the route's validated search instead of parsing `location.search` or `window.location`.
- [ ] [Internal] ✍️ The view-settings URL sync and the planner prefill sync write through a new `useRouteSearchWriter` (router `navigate` with `replace`, kept hash, history state and scroll) instead of `history.replaceState`; it skips no-op writes and drops writes from a page that is being left (#586).
- [ ] [Internal] 🔁 The view-settings sync no longer wipes router history state when it updates the address.
- [ ] [Internal] 🚪 The remaining `window.location.assign` calls (Paddle billing portal, sign-in reload, provider-less login fallback) carry a comment on why they deliberately leave the SPA.
- [ ] [Internal] 🧪 Regression tests cover schema parsing and byte-for-byte round trips, router-owned writes without loader reloads or remounts, the leave-page and version-switch cases, and the planner sign-in return path.
