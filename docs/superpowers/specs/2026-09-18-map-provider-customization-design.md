# Map provider switching, city framing and customization

Date: 2026-09-18
Status: approved, in implementation

## Problem

Three complaints, one surface.

1. **No provider choice in the product.** `shared/mapRuntime.ts` already resolves a full
   per-subsystem `google | mapbox` runtime, but the only way to change it is an admin debug
   cookie plus a page reload. A traveller can change the map *style* and nothing else.
2. **City focus frames the wrong thing.** Selecting a city sets a constant zoom
   (`selection.cityFocusZoom = 14`) on the city centroid. A large city overflows the viewport;
   a small one is swallowed by its region. City markers and connection lines stay drawn on top
   of the one city being looked at, and there is no way to let go of the selection — the mobile
   sheet's smallest snap is 168px and collapsing it keeps the city selected.
3. **Customization has no home.** The `Layers` popover in `ItineraryMap.tsx` is a 40px-wide
   column of 10px English-only buttons. Options the renderer already supports
   (roads, POI labels, boundaries, pitch, terrain) are unreachable.

## Decisions taken

| Question | Decision |
| --- | --- |
| Apple Maps | Deep-link handoff now; MapKit JS written up as a later phase with its credential cost stated. It is not a basemap in this phase. |
| What a provider switch changes | The renderer/basemap only. Routes, place search and static maps stay on the admin preset. |
| Apple's placement | A visually distinct handoff card inside the provider picker, labelled so it is obvious it opens the Apple Maps app. |
| City framing source | The trip's own activities and stays in that city. No bbox fetch. |
| Persistence | Trip setting overrides user default; an explicit action promotes the current look to the user default. |

## Architecture

### The renderer is an overlay swap, not two maps

Google's map is always the interaction layer. "Mapbox" means Google's tile pane is hidden
(`opacity: 0`) and a camera-synced Mapbox GL canvas renders underneath, with markers and
polylines retargeted by `resolveActiveOverlayMapTarget`. `isMapboxBasemapEnabled` is already a
reactive boolean feeding the marker rebuild effect. A live provider swap is therefore a state
change, not a remount — the only reason it needs a reload today is that `MapRuntimeProvider`
resolves the runtime in `useMemo(…, [])`.

### Preference resolution

One pure function merges three layers into a single `ResolvedMapPreferences`:

```
admin cookie override  →  trip view settings  →  user settings  →  app defaults
```

The admin override stays on top so the debug tool keeps meaning what it says. The user's
renderer choice is fed into the existing `resolveMapRuntime()` as a `selection.renderer`
partial, so capability gating, availability fallback and the warning strings are reused rather
than reimplemented.

New customization fields live in a nested `mapCustomization` object on both `IViewSettings`
and `IUserSettings`. The existing flat fields (`mapStyle`, `routeMode`, `showCityNames`,
`zoomLevel`, `zoomBehavior`, `mapDockMode`) stay exactly where they are and the modal edits
them in place. Nothing migrates; the normalizer is the only place that knows about both.

### City framing

`components/maps/tripMapCityFraming.ts` is a pure module:

```
resolveCityFocusCamera({ city, activities, provider, viewportSize, dockMode })
  → { kind: 'bounds', bounds, padding } | { kind: 'center', center, zoom }
```

It fits the bounding box of the city centre plus that city's own activities and stays, applies
a minimum span so a single-activity city does not slam to street level, and clamps the
resulting zoom to `cityFitMinZoom`/`cityFitMaxZoom`. It returns a `center` result only when the
city has no usable activity coordinates, which is the one case the old constant was right for.

Being pure, it is testable without a map instance. The map layer's job is only to apply the
result — `fitBounds` with padding on Google, `fitBounds` on Mapbox.

### City focus mode

`isCityFocusMode = Boolean(selectedCityId) && !selectedActivityId`, gated by a preference.

While on, city markers, city labels and every connection/route polyline hide, leaving that
city's activity and POI markers alone on the map. Four ways out, all ending at a null
selection: a "Show whole journey" pill on the map, tapping empty map, collapsing the mobile
sheet to a new `hidden` snap, and Escape — which `useTripSelectionController` already handles,
so it needs nothing new.

**The mobile sheet is deliberately non-modal.** Seeing the map behind it is the entire point,
so it takes `role="dialog"`, Escape, a real close control and focus restored to the trigger,
but not `aria-modal` and not a focus trap. This is a considered deviation from the repo's
overlay rule, not an oversight.

### The customize modal

`AppModal` on desktop, `drawer.tsx` bottom sheet at ~55% height on mobile so the map stays
visible and every change applies live. Composed from `settings-panel.tsx`, `switch`, `select`,
`slider` and `tabs` — nothing hand-rolled.

| Tab | Controls |
| --- | --- |
| Basemap | provider, style, light/dark/auto |
| Journey | route mode, line colour, line weight, flight curve |
| Places | city labels, city marker style, activity markers, POI labels, road & transit detail, admin boundaries |
| Camera | city framing, fit vs manual zoom, globe vs flat, pitch, terrain |

Footer: reset to defaults, save as my default, copy/paste preset JSON.

A shared trip opens with its author's saved look and a one-tap "use my settings".

## Phases

1. City framing, focus mode, the escape hatch.
2. The customize modal over the settings that already exist.
3. User-facing provider switching, live swap, Apple handoff.
4. The new customization dimensions.
5. Written up only: MapKit JS as a third renderer.

Tests, locale parity and the release note land after the four implementation phases, at the
user's explicit instruction.

## Out of scope

- Fetching or caching city bounding boxes from any provider.
- Exposing routes / place search / static maps as user-facing choices.
- MapKit JS implementation.
