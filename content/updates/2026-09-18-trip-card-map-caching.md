---
id: rel-2026-09-18-trip-card-map-caching
version: v0.179.0
title: "Trip card maps appear instead of loading"
date: 2026-09-18
published_at: 2026-09-18T21:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The little route map on every trip card used to be drawn from scratch each time you opened your trips. Now it is drawn once and kept, so your cards come up with their maps already on them and only redraw once a trip has actually changed and settled."
---

## Changes
- [x] [Improved] 🗺️ The route map on a trip card is now kept once it has been drawn, so opening your trips shows the maps straight away instead of a grid of loading tiles.
- [x] [Improved] 🪶 Those maps are also about a third lighter to download, which is most noticeable on a phone and on a slow connection.
- [x] [Improved] 🔄 A card's map redraws only when the trip behind it changes — move a stop or recolour it and the new map appears; otherwise you get the one you already have.
- [x] [Improved] ⏳ While you are still rearranging a trip, its card keeps the map it already has and picks up your changes once you have settled, instead of redrawing after every single edit. The trip's own map is live as always.
- [x] [Fixed] 📲 Trip card maps you have already seen now stay with the installed app offline, which is what the offline trips list promised.
- [ ] [Internal] `/api/trip-map-preview` returns the rendered image itself instead of a 302 to the provider, so Netlify's durable CDN cache holds the bytes. Previously every visitor with a cold browser cache paid a fresh billed static render, plus up to 8 Directions calls per preview at the edge, because the image never passed through our origin.
- [ ] [Internal] Provider tokens no longer appear in a `Location` header on a public endpoint.
- [ ] [Internal] Mapbox renders are requested as WebP (~146 KB vs ~256 KB at 640x360@2x). Google renders stay PNG to avoid JPEG artefacts on flat fills.
- [ ] [Internal] `buildMiniMapUrl` omits `language` when static maps come from Mapbox, which ignores it — nine locales were buying nine identical renders of every trip.
- [ ] [Internal] Every upstream call from the edge function is now bounded (`DIRECTIONS_TIMEOUT_MS`, `UPSTREAM_IMAGE_TIMEOUT_MS`); a failed or slow render degrades to the old redirect with `Cache-Control: no-store` rather than caching a broken picture.
- [ ] [Internal] The service worker's map-preview cache was unreachable before: a cross-origin redirect followed from a no-cors `<img>` yields an opaque response, which `isStorableResponse` rejects. Same-origin bytes are storable.
- [ ] [Internal] Added `services/tripMapPreviewSettleService.ts`: a card holds its adopted preview URL until the trip has been unchanged for `TRIP_MAP_PREVIEW_SETTLE_MS` (5 min), so a burst of edits collapses into one render rather than one per intermediate state. Per-device `localStorage` (`tf_trip_map_preview_settle_v1`, capped at 200 trips, registered in the storage registry); every access is wrapped so blocked storage degrades to rendering the current state. Admin surfaces keep the unsettled URL.
- [ ] [Internal] Route lookups for a preview now run in parallel. The Directions budget is assigned by `planRealisticLegs` before any request goes out, so a five-stop card no longer waits for four sequential round trips; the per-request cap is unchanged. Cold render measured at 1.9-3.5s before, against 70-250ms for a cached one.
- [ ] [Internal] Added `docs/TRIP_MAP_PREVIEW_CACHING.md`; extended `tests/unit/tripMapPreviewEdge.test.ts` with proxy, cache-header, degraded-redirect and WebP coverage; added `tests/unit/tripMapPreviewSettle.test.ts`. Recorded the four invariants in `CLAUDE.md` so a future agent does not reintroduce the redirect.
