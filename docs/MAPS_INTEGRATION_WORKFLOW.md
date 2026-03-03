# Maps Integration Workflow

This repo standardizes Google Maps integration on `@vis.gl/react-google-maps`.

## Scope
Use this guide whenever you add or change maps in planner, profile/admin cards, marketing/blog, or shared routes.

## Required architecture
1. Wrap map surfaces under `GoogleMapsLoader` and use `useGoogleMaps()` for load state.
2. Render map canvases with `Map` from `@vis.gl/react-google-maps`.
3. Access map instances via `useMap(id)` bridge patterns (see `components/ItineraryMap.tsx`).
4. Do not add direct script tag loaders, custom `window.initMap` bootstraps, or duplicate Google loader code.

## Routing API policy
1. Primary route computation is `google.maps.routes.Route.computeRoutes` via `importLibrary('routes')`.
2. Keep an explicit field mask and only request fields we use (`path`, `distanceMeters`, `durationMillis`).
3. Use compatibility retry (`['path']`) on field-mask errors before failing over.
4. Do not call deprecated `google.maps.DirectionsService`; fall back to straight-line rendering when Routes fails.

## Places policy
1. Do not use deprecated `google.maps.places.PlacesService` in new or updated flows.
2. Do not use deprecated `google.maps.places.Autocomplete` in new or updated flows.
3. Use `Place.searchByText(...)` plus geocoder fallback for city/hotel search interactions.
4. Keep Places calls lazy (triggered on user action), not on panel open/render.

## Marker policy
1. Itinerary markers use custom `OverlayView` DOM markers (city + transport) to avoid deprecated `google.maps.Marker` without forcing a `mapId` migration.
2. Do not introduce new direct `google.maps.Marker` implementations in any surface.
3. If we adopt `AdvancedMarkerElement`, do it in a dedicated migration with map-id readiness and regression coverage.
4. Marker deprecation warnings are runtime API warnings and are not caused by old trip data in DB records.

## Label overlay policy
1. Keep map text labels city-only (`getMapLabelCityName(...)`), not city+country strings.
2. Use `resolveCityLabelAnchor(...)` to pick `right/left/below/above` label anchors from adjacent leg geometry; avoid hardcoding one side.
3. Mount text overlays on high panes (`floatPane` fallback chain) so labels render above route polylines.
4. For `cleanDark`, keep city labels high-contrast (white text + dark shadow) and START/END accents lighter (`--tf-accent-200` fallback).
5. Keep `clean` label shadow/color behavior unchanged from legacy styling unless an issue explicitly asks for a visual redesign.

## Route styling policy
1. Keep dark route layering with a cutout approach: inner gap + softened outer edge.
2. For dark styles, use route-colored outer edge with reduced opacity (currently `0.5`) for realistic routes.
3. Do not apply the outer edge to dashed fallback routes; keep dashed legs visually distinct from realistic road-like routes.
4. Tune non-dark cutout tones to the basemap background (`standard`/`clean`/`minimal`) instead of using one shared dark gap tone.

## Trip data compatibility
1. Legacy trip entries must be normalized on load (transport aliases -> canonical mode, travel item/type alignment).
2. Normalization should happen at route/app load boundaries, not via one-off DB migrations.
3. No-op transport updates (same mode reselected) must be ignored to prevent needless history/route churn.

## Caching and cost control
1. Reuse `buildRouteCacheKey(...)` for leg-level cache identity.
2. Keep cache usage mode-aware and coordinate-aware.
3. Avoid unnecessary recomputation by preserving no-op guards in update handlers.

## Blog and marketing usage
1. For static visual previews, prefer `/api/trip-map-preview` over direct external Static Maps URLs.
2. For interactive canvases, still use `GoogleMapsLoader` + `Map` from `@vis.gl/react-google-maps`.
3. Keep key handling inside existing runtime/env utilities. Never hardcode API keys.

## Validation checklist
- `pnpm test:core`
- `pnpm build`
- `pnpm dlx react-doctor@latest . --verbose --diff` after substantial React map changes
- Update `content/updates/*.md` (single draft file per feature worktree)
