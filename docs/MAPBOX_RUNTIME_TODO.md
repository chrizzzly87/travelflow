# Mapbox Runtime Follow-up Checklist

This checklist tracks the remaining Mapbox-only work on the
`codex/map-runtime-dual-provider-foundation` branch.

## Shared state

- [x] Restore shared TripView and route-loader behavior to current `origin/main`.
- [x] Keep Mapbox visual changes isolated from planner commit/history sequencing.
- [x] Add safe local-history fallback and self-heal for oversized visual entries.

## Trip page rendering

- [x] Show the Mapbox basemap while keeping planner functionality intact.
- [x] Render trip overlays natively on the Mapbox trip page.
- [x] Keep routes visible on first load before realistic directions finish computing.
- [x] Add a north-up intro camera flow for Mapbox.
- [x] Use the city/location name for trip labels instead of custom stay titles.
- [x] Remove duplicate round-trip endpoint labels by deduping on the displayed city name.

## Label and marker presentation

- [x] Extract provider-aware city marker HTML.
- [x] Extract provider-aware city label HTML.
- [x] Add Mapbox-only projected label layout for crowded cities.
- [x] Improve label collision handling for very dense clusters.
- [x] Add richer photo/image marker inputs on top of the extracted marker presenter.

## Styling

- [x] Start clean and cleanDark from a cleaner Mapbox config baseline.
- [x] Reduce the remaining high-level road and highway clutter on clean styles.
- [x] Constrain visible Mapbox country-boundary layers to `admin_level = 0` when the style exposes that data.
- [x] Replace fragile built-in country/admin boundary handling with a dedicated Countries v1 country-border overlay.
- [x] Make country outlines zoom-aware so they stay slimmer at far zooms.
- [x] Reapply clean-style Mapbox polish after late Standard layer loads so hidden roads and admin layers do not leak back in after the first paint.
- [x] Keep Mapbox trip labels above-centered by default, hiding low-priority crowded pills before flipping them below the marker.
- [ ] Revisit live border treatment so only the intended country outline remains on clean and satellite styles.
- [ ] Tune satellite border treatment after the main clean-style pass is stable.
- [ ] Verify that clean styles keep only country names plus the biggest city labels in live visual checks.

## Follow-up

- [ ] Extract more Mapbox overlay orchestration out of `ItineraryMap`.
- [ ] Revisit preview/OG Mapbox styling once the trip-page visual contract is stable.
