---
id: rel-2026-09-19-planner-survives-map-start
version: v0.183.0
title: "Your place in a trip survives the map starting up"
date: 2026-09-19
published_at: 2026-09-19T18:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Opening a trip and touching it straight away no longer loses what you did: the planner used to be rebuilt from scratch a few seconds in, when the map finished starting."
---

## Changes
- [x] [Fixed] 🧭 What you do in the first seconds of opening a trip now sticks. The planner was being rebuilt from scratch when the map finished starting up, a few seconds after the page appeared — so the day you had picked, how far you had pulled the day sheet open, where you had scrolled and how far you had zoomed the timeline were all quietly thrown away. On a phone it also made the day sheet slide open a second time.
- [ ] [Internal] 🌳 Root cause: `MapRuntimeProvider` rendered `children` bare while the map was deferred and wrapped in `<APIProvider>` once it was not. React reconciles by position, so that swap re-parented the entire subtree — on a trip route, the whole planner — and remounted it. Confirmed in the running app: fresh sheet and map-pane nodes at t=4250ms, which is `useDeferredMapBootstrap`'s 4s ceiling, immediately before the map mounts.
- [ ] [Internal] 🚪 The script now mounts in `GoogleMapsApiGate`, rendered around `ItineraryMapComponent` inside `buildMap`. That is the only boundary whose children are re-parented, and the map is the only thing under it, so nothing holding state is remounted. `MapRuntimeProvider` keeps one fixed depth for its children and lost its `enabled` prop — deferral is now decided by whether a gate is rendered at all, which `isMapBootstrapEnabled` already governs, so the Maps script still loads late (measured: 4961ms).
- [ ] [Internal] 🔌 Only `ItineraryMap` needs to be inside `APIProvider` (`useMap`, `<GoogleMap>`). `DetailsPanel` and `AddCityModal` read `useGoogleMaps().isLoaded` from `GoogleMapsContext`, which `MapRuntimeProvider` still provides above the gate, so their place lookups are unaffected. The gate reports load state upward through a new internal context rather than owning it.
- [ ] [Internal] 📏 Measured A/B on a 375×812 viewport, expanding the day sheet to `full` two seconds in and reading it back after the map loads: on `main` the snap is `half` (436px) — reset; with this change it is `full` (751px). Sheet node identity confirms it: one node, where `main` mounts a second at 4250ms.
- [ ] [Internal] ⚠️ Local verification of the map's own rendering was inconclusive and is **not** evidence either way: whether the map visually settles on the trip within ten seconds is flaky on this dev server on `main` too — one `main` run framed the route, the next was still blank at 16s. What is stable across runs on this branch is that the Google Maps script loads, `window.google.maps` is present and the Mapbox canvas mounts. Per `docs/NETLIFY_FEATURE_BRANCH_DEPLOY.md`, anything map- or `/api/*`-dependent gets verified on a real Deploy Preview, which is where the camera framing should be signed off.
- [ ] [Internal] 🧪 `tests/browser/mapRuntimeProviderTreeStability.browser.test.ts` pins the invariant: mounting a gate must not remount its siblings, the provider must never mount `APIProvider` itself, and the planner must not end up inside the gate. Put `APIProvider` back above the planner and it fails.
