# Standalone Mapbox map runtime — design

Date: 2026-11-01
Status: draft, awaiting approval

## Why

The Google Maps browser key was deleted for a security reason. Production still
ships it (`VITE_GOOGLE_MAPS_API_KEY` is set on Netlify, preset `google_all`), so
every trip map now sits on "Loading map…" and every route request fails with
`API Key not found`.

The "Mapbox" renderer cannot save us today: `MapboxBasemapSync` is a skin over a
hidden Google map. It does not start without a `google.maps.Map`
(`components/maps/MapboxBasemapSync.tsx:263`), and `ItineraryMap` only marks the
map initialized from the Google instance bridge.

The owner will add a new Google key later. Until then the trip map has to work
on Mapbox alone, and the owner wants to switch back to Google from the admin
settings — no code change, no deploy.

## Goals

1. Preset `mapbox_all` ("Mapbox for everything") runs with **no Google script
   loaded at all**, whether or not a Google key is configured.
2. In that preset the trip map shows: the Mapbox basemap, city markers and
   labels, activity / day-trip / idea / transport markers, popups, the user
   location dot, and **straight route lines** between stops. Pan, zoom, fit to
   trip, city focus, activity focus and recenter all work.
3. Road routing is **switched off** in that preset (straight lines). City
   search runs on Mapbox, so travellers can still add cities. Activity and
   hotel search are off — not silently pointed at Google, not spinning
   forever; the traveller gets a short, honest message.
4. The admin settings page says what each preset really does, and whether the
   keys it needs are configured, so the owner can tell before switching.
5. Switching the preset in admin takes effect on the next page load for
   travellers, with no deploy.

## Non-goals

- Mapbox Directions or Mapbox geocoding/search on the client. Straight lines
  and no place search are acceptable for "the next few weeks" (owner's words:
  "it's acceptable").
- Removing the Google mixed-surface path. `mapbox_visual_google_services` keeps
  working exactly as today once a Google key is back.
- Blog post maps (`pages/BlogPostPage.tsx` already falls back to an iframe),
  the trip print view, the admin airports page, Google My Maps import, and the
  Trip Agent's Google Maps MCP (`netlify/edge-lib/trip-agent-maps-mcp.ts`)
  stay Google-only and simply report "unavailable" without a key.
- A new preset value. The database CHECK on
  `app_runtime_settings.map_runtime_preset` stays as it is, so no migration.

## Anti-goals

- Loading the Google script "just in case" while on `mapbox_all`. The broken
  key must cause no request, no console error, no auth-failure overlay.
- An endless spinner anywhere. Every surface either works or says it is off.
- Regressing `google_all` or `mapbox_visual_google_services` when a valid
  Google key is present.

## Decisions

### 1. Runtime resolution (`shared/mapRuntime.ts`)

- Add a third implementation value for services: `'none'`. `MapImplementation`
  for `routes` and `locationSearch` may resolve to `'none'`; `renderer` and
  `staticMaps` stay `'google' | 'mapbox'`.
- `mapbox_all` maps to `{ renderer: 'mapbox', routes: 'none',
  locationSearch: 'mapbox', staticMaps: 'mapbox' }`, where Mapbox location
  search means **city lookup only** (see section 4). It no longer falls back to
  Google for anything, so its meaning does not depend on whether a Google key
  happens to be set.
- If the Mapbox token is missing, `mapbox_all` falls back to Google for every
  subsystem (renderer, routes, search), i.e. the old full-Google behaviour,
  with the existing warning. *(Design call: a Google map with straight lines
  and no search would be the worst of both. Production has a token, so this
  is an edge case.)*
- Under `mapbox_all` the preset wins over a traveller's own renderer choice.
  A trip saved with "Google", or a pick of "Google" in the customize sheet
  (`MapCustomizeModal`), resolves to `renderer: 'mapbox'` while the preset is
  active. The stored preference is left untouched (not rewritten), so it
  applies again once the preset changes. In the customize sheet the Google
  option is disabled with a one-line note. *(Design call; the note is
  user-facing copy and goes through EN/DE sign-off.)* The admin debug cookie
  still wins, as today.
- Expose `usesGoogle(resolution): boolean` — true when any effective subsystem
  is `'google'`. This is the single switch for loading the Google script.
- The cache codes (`MAP_IMPLEMENTATION_CACHE_CODES`) get a code for `'none'`
  so preview-image cache keys stay distinct.

### 2. Provider (`components/MapRuntimeProvider.tsx`)

- When `usesGoogle(runtime)` is false:
  - `GoogleMapsApiGate` and `GoogleMapsLoader` render their children bare (no
    `APIProvider`). This is one central rule, so every Google-only surface
    (print view map, blog maps, admin airports page) shows its
    unavailable/error state instead of loading the key. *(Design call.)*
  - No `loadError` is set for a missing or invalid Google key, and
    `gm_authFailure` is not installed.
  - `useGoogleMaps()` reports `{ isLoaded: false, loadError: null,
    disabled: true }` so consumers can tell "off" from "still loading".
- The runtime re-resolves when the admin preset arrives. Today
  `setRuntimeMapPreset` writes a module variable and nothing listens. Turn it
  into a small external store (same shape as the renderer-choice store already
  in `services/mapRuntimeService.ts`) and read it with `useSyncExternalStore`.
- The public runtime settings (`loadPublicAiRuntimeSettings`) must be loaded on
  every route that mounts a trip map, including `/draft/*` and shared trips —
  not only where the Trip Agent hook happens to call it. Load it once at the
  provider. Until it arrives, the env default (`VITE_MAP_RUNTIME_PRESET`) is
  used; the map must not mount Google first and then switch, so the trip map
  waits for the settings (with the existing "Loading map…" overlay) when the
  env default and the possible admin value could differ. *(Builder's call how
  to express that wait; a short timeout falling back to the env default is
  fine.)*

### 3. Trip map (`components/ItineraryMap.tsx` + `MapboxBasemapSync`)

Add a **standalone Mapbox mode**, active when the effective renderer is
`mapbox` and `usesGoogle` is false. The mixed mode (Mapbox skin over Google)
stays for `mapbox_visual_google_services`.

- `MapboxBasemapSync` gets a `standalone` mode: no `googleMap` needed, it owns
  the camera, does no Google sync, and takes the globe-intro target from the
  trip bounds instead of `readGoogleCameraTarget`.
  `components/admin/AdminAirportTesterMap.tsx` (`MapboxTesterMapLayer`) is the
  working reference for a standalone Mapbox map with `LngLatBounds`/`fitBounds`.
- `mapInitialized` comes from the Mapbox surface being ready in standalone
  mode.
- Introduce a small **camera adapter** with two implementations (Google,
  Mapbox): `fitBounds(points, padding)`, `panTo`, `setZoom`/`getZoom`,
  `containsPoint` (for the user-location in-view check), `onIdle`, `onZoom`,
  `resize`. Route every current Google-only camera call through it:
  `runFitBounds`, `scheduleFitWhenViewportReady`, city-focus framing,
  activity pan/zoom, recenter-on-user, the `zoom_changed` listener that feeds
  `mapZoomLevel` (the activity-marker zoom gate depends on it), the
  `ResizeObserver`, and the `idle` in-view check.
- Remove `window.google.maps.*` from the Mapbox drawing path: `SymbolPath` in
  `drawRoutePath` / `drawFallbackLegVisual`, `TravelMode` in `drawRoutes`. The
  Mapbox route layers already draw arrows themselves
  (`buildMapboxRouteLayerConfigs`); the Google arrow icon is only built on the
  Google branch.
- Routing: when `runtime.effectiveSelection.routes === 'none'`, `drawRoutes`
  draws straight lines directly — no Routes API call, no "falling back to
  line" warning, no write to the route cache. Cached realistic routes from
  `tf_route_cache_v1` may still be drawn if present *(builder's call; dropping
  them is also fine)*.
- The Geocoder-backed focus query (around line 2451) is skipped when
  `locationSearch === 'none'`.
- Style/map-type, traffic and transit controls that only apply to Google stay
  hidden in standalone mode (they are already skipped with Mapbox on).
- A Mapbox load error in standalone mode shows the existing error overlay
  instead of falling back to Google.

### 4. Place search surfaces

Adding a city must keep working (owner's decision). Today every add-city path,
including the typed "manual" one, geocodes through Google, and `onAdd(name,
lat, lng)` needs coordinates.

- **Mapbox city search.** Add a Mapbox implementation to
  `services/locationSearchService.ts` for city lookup only: the Mapbox
  Geocoding API (v6 forward, `types=place`, the existing public
  `VITE_MAPBOX_ACCESS_TOKEN`, the UI language), returning the same shape the
  Google path returns (name, country, coordinates). Used when
  `locationSearch === 'mapbox'`. `AddCityModal` uses it for both suggestions
  and the typed-name path, and stops gating on Google's `isLoaded`.
- Set `MAP_IMPLEMENTATION_CAPABILITIES.mapbox.locationSearch` to `true`, with a
  comment that it covers cities only.
- **Everything else stays off under Mapbox**: activity and hotel search in
  `DetailsPanel`, `AddActivityModal` place lookup, and the coordinate
  resolution of activities without coordinates (`activityLocationResolver`,
  `resolveItemCoordinates`). They show a short notice that place search is
  unavailable right now, never a spinner. Activities without coordinates
  simply have no pin until Google returns. `TripManager` skips quietly.
  *(Design call: city lookup is the one thing that blocks building a trip.)*

New copy is user-facing: it needs EN and DE sign-off from the owner, and keys
in all active locales (`en es de fr pt ru it pl ko fa ur`).

### 5. Admin settings (`pages/AdminGlobalSettingsPage.tsx`)

- Rewrite the preset notes to match reality (admin copy is English-only, no
  sign-off needed):
  - Google for everything — needs a Google key.
  - Mapbox visuals, Google services — needs both.
  - Mapbox for everything — needs a Mapbox token; Google is not loaded; routes
    are straight lines, city search uses Mapbox, activity and hotel search
    are off.
- Next to the select, show for this deploy whether a Google key and a Mapbox
  token are **configured** (build-time presence, not validity — say so), and
  warn when the selected preset needs one that is missing.

### 6. Edge and previews

Already honour the preset via `resolveEdgeMapRuntimeAsync`
(`netlify/edge-lib/map-runtime.ts`). `trip-map-preview` and the OG images use
Mapbox for `staticMaps === 'mapbox'`. Two adjustments:

- `routes === 'none'` → preview and OG route lines are straight; do not try
  Google.
- The edge resolver mirrors the shared resolution, so it picks up `'none'`
  from `shared/mapRuntime.ts` without its own copy.

## Rollout

1. Ship the code (one PR, release note per `docs/UPDATE_FORMAT.md`).
2. Set `VITE_MAP_RUNTIME_PRESET=mapbox_all` on Netlify **before** that
   production build, and set the admin preset to "Mapbox for everything" once
   it is `ready`. Both are needed: if the settings fetch fails or times out,
   the client falls back to the env default, and that must not be the dead
   Google key. The dead Google key can stay in the env until the new one
   replaces it — it is never loaded.

`google_all` with a key Google rejects is **not** auto-switched to Mapbox
(that would be a runtime switch after load, which the no-remount rule in
`MapRuntimeProvider` makes expensive). It must show the existing "Error
loading map" overlay rather than "Loading map…": today `gm_authFailure` does
not fire for a deleted key and the map spins. The builder makes the map show
the error when Google never initializes (for example a load timeout).
*(Design call.)*
3. Later: add the new Google key on Netlify, rebuild, switch the preset back in
   admin.

## Testing

- `tests/unit/mapRuntime.test.ts`: `mapbox_all` resolves services to `'none'`
  with or without a Google key; `usesGoogle` truth table; missing Mapbox token
  still falls back.
- Browser: `MapRuntimeProvider` does not load the Google script and sets no
  `loadError` under `mapbox_all` with an invalid key; preset store
  re-resolution.
- Browser: `ItineraryMap` in standalone mode mounts a Mapbox map with no
  `window.google`, draws markers and straight lines, fits to the trip, tracks
  zoom (activity markers appear past the gate) — regression for today's
  endless "Loading map…".
- `locationSearchService` Mapbox city lookup: request shape (types, language,
  token) and response mapping, with `fetch` mocked.
- `AddCityModal` under `mapbox_all` with no `window.google`: suggestions and
  the typed-name path both add a city with coordinates.
- `DetailsPanel` / `AddActivityModal`: unavailable notice instead of a
  spinner.
- Admin settings page: notes and configured-key warnings.
- Existing mixed-mode and Google tests stay green.

## Left to the builder

- Exact shape and file of the camera adapter.
- How the provider waits for the admin preset before mounting the map.
- Whether cached realistic routes are reused in standalone mode.
- Whether to split the work into more than one PR (runtime + admin, then map).
