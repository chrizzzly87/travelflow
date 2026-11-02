# Standalone Mapbox Map Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Under the `mapbox_all` preset, TravelFlow's trip map, city search and previews run on Mapbox with no Google script loaded, switchable back from admin settings.

**Architecture:** `shared/mapRuntime.ts` gains a `'none'` service implementation and a `usesGoogle()` switch. The provider stops mounting Google when nothing uses it. `MapboxBasemapSync` gets a standalone mode that owns the camera, and `ItineraryMap` drives camera calls through a small adapter with Google and Mapbox implementations. City search gets a Mapbox Geocoding implementation.

**Tech Stack:** React 19, TypeScript, mapbox-gl, @vis.gl/react-google-maps, Vitest (unit + browser), Netlify edge functions (Deno), Supabase.

**Spec:** `docs/superpowers/specs/2026-11-01-standalone-mapbox-design.md`

## Global Constraints

- Under `mapbox_all` with a Mapbox token: no request to `maps.googleapis.com`, no `window.google` access on any code path, no `gm_authFailure` handler.
- No database migration: `map_runtime_preset` keeps its three values.
- Existing behaviour of `google_all` and `mapbox_visual_google_services` with a valid Google key is unchanged.
- No endless spinner anywhere: every surface either works or says it is off.
- New user-facing copy: EN and DE sign-off from the owner before merge; keys in `en es de fr pt ru it pl ko fa ur`; single-brace `{name}` placeholders. Admin copy is English-only, no sign-off.
- UI uses `components/ui/` primitives (`Button`, `Select`, …); no native `<select>`.
- `pnpm typecheck` stays at 0 errors; no `@ts-ignore`, blanket `any` or tsconfig weakening.
- Node 22 (`~/.nvm/versions/node/v22.20.0/bin`) for all commands.

## Review Focus

1. **The admin settings request fails or is slow.** The client must use `VITE_MAP_RUNTIME_PRESET`, never the hard-coded `'google_all'` default (today `loadPublicAiRuntimeSettings` applies `DEFAULT_AI_RUNTIME_SETTINGS` on error, which forces Google). Test in Task 2.
2. **A trip saved with renderer "google" opened under `mapbox_all`.** Must render Mapbox and load no Google script. Test in Task 3.
3. **A Google key that Google rejects under `google_all`.** Must end on "Error loading map", not "Loading map…". Test in Task 6.
4. **A trip with zero or one city** in standalone Mapbox mode: no `fitBounds` on empty bounds, no thrown error, the map still marks itself ready. Test in Task 5.
5. **Mapbox Geocoding returns no result or an HTTP error** for a typed city: the add-city dialog shows its existing "not found" state, no unhandled rejection. Test in Task 7.

---

### Task 1: Runtime resolution with a `'none'` service implementation

**Files:**
- Modify: `shared/mapRuntime.ts`
- Test: `tests/unit/mapRuntime.test.ts`

**Interfaces:**
- Produces:
  - `type MapServiceImplementation = MapImplementation | 'none'`
  - `MapRuntimeSelection` becomes `{ renderer: MapImplementation; routes: MapServiceImplementation; locationSearch: MapServiceImplementation; staticMaps: MapImplementation }`
  - `MAP_RUNTIME_PRESET_TO_SELECTION.mapbox_all = { renderer: 'mapbox', routes: 'none', locationSearch: 'mapbox', staticMaps: 'mapbox' }`
  - `MAP_IMPLEMENTATION_CAPABILITIES.mapbox.locationSearch = true` (comment: city lookup only)
  - `usesGoogle(selection: MapRuntimeSelection): boolean`: true when any subsystem is `'google'`
  - `isRendererLockedByPreset(preset: MapRuntimePreset): boolean`: true only for `'mapbox_all'`
  - Cache code `'n'` for `'none'`; `parseMapRuntimeSelectionCacheKey('mnmm')` round-trips.

- [ ] **Step 1: Write the failing tests** in `tests/unit/mapRuntime.test.ts`:

```ts
it('mapbox_all needs no Google, with or without a Google key', () => {
  for (const googleMapsKeyAvailable of [true, false]) {
    const r = resolveMapRuntime({ defaultPreset: 'mapbox_all', availability: { googleMapsKeyAvailable, mapboxAccessTokenAvailable: true } });
    expect(r.effectiveSelection).toEqual({ renderer: 'mapbox', routes: 'none', locationSearch: 'mapbox', staticMaps: 'mapbox' });
    expect(usesGoogle(r.effectiveSelection)).toBe(false);
    expect(r.warnings).toEqual([]);
    expect(r.activeSelectionKey).toBe('mnmm');
  }
});
it('mapbox_all without a Mapbox token falls back to full Google', () => {
  const r = resolveMapRuntime({ defaultPreset: 'mapbox_all', availability: { googleMapsKeyAvailable: true, mapboxAccessTokenAvailable: false } });
  expect(r.effectiveSelection).toEqual({ renderer: 'google', routes: 'google', locationSearch: 'google', staticMaps: 'google' });
  expect(r.warnings.length).toBeGreaterThan(0);
});
it('usesGoogle is true for the other presets', () => {
  const a = { googleMapsKeyAvailable: true, mapboxAccessTokenAvailable: true };
  expect(usesGoogle(resolveMapRuntime({ defaultPreset: 'google_all', availability: a }).effectiveSelection)).toBe(true);
  expect(usesGoogle(resolveMapRuntime({ defaultPreset: 'mapbox_visual_google_services', availability: a }).effectiveSelection)).toBe(true);
});
it('round-trips the none cache code', () => {
  expect(parseMapRuntimeSelectionCacheKey('mnmm')).toEqual({ renderer: 'mapbox', routes: 'none', locationSearch: 'mapbox', staticMaps: 'mapbox' });
});
it('locks the renderer only for mapbox_all', () => {
  expect(isRendererLockedByPreset('mapbox_all')).toBe(true);
  expect(isRendererLockedByPreset('google_all')).toBe(false);
});
```

- [ ] **Step 2: Run, expect FAIL** (`usesGoogle` not exported): `pnpm vitest run tests/unit/mapRuntime.test.ts`

- [ ] **Step 3: Implement** the interfaces above. `'none'` is always available in `isImplementationAvailableForSubsystem`. `mergeMapRuntimeSelection` accepts `'none'` for routes/locationSearch only. When the requested preset is `mapbox_all` and `mapboxAccessTokenAvailable` is false, resolve from `google_all`'s selection and push one warning: `Map runtime fallback: Mapbox token is missing, so "Mapbox for everything" runs on Google.`

- [ ] **Step 4: Run, expect PASS**, then `pnpm typecheck`. Fix the type fallout from the widened selection (`netlify/edge-lib/map-runtime.ts`, `services/locationSearchService.ts`, `components/OnPageDebugger.tsx`, `components/profile/tripPreviewUtils.ts`) without changing behaviour yet.

- [ ] **Step 5: Commit** `feat(maps): add a 'none' service implementation for mapbox_all`

---

### Task 2: Subscribable preset store; settings failure keeps the env default

**Files:**
- Modify: `services/mapRuntimeService.ts`, `services/aiRuntimeSettingsService.ts`
- Test: `tests/unit/aiRuntimeSettingsService.test.ts`, `tests/browser/mapRuntimeService.browser.test.ts`

**Interfaces:**
- Produces in `services/mapRuntimeService.ts`:
  - `subscribeToRuntimeMapPreset(listener: () => void): () => void`
  - `getRuntimeMapPresetSnapshot(): MapRuntimePreset | null`: the admin value or null
  - `setRuntimeMapPreset(preset)` notifies listeners when the value changes
- Changes in `loadPublicAiRuntimeSettings`: on RPC error, or without a supabase client, call `setRuntimeMapPreset(null)` instead of applying `'google_all'`. Other defaults are applied as today.

- [ ] **Step 1: Write the failing tests:**
  - `aiRuntimeSettingsService.test.ts` › `'leaves the map preset to the env default when the settings RPC fails'`: mock the RPC error; expect `getRuntimeMapPresetSnapshot()` to be `null`.
  - `mapRuntimeService.browser.test.ts` › `'notifies subscribers when the admin preset changes'`: subscribe, `setRuntimeMapPreset('mapbox_all')`; expect one call and `getDefaultMapRuntimePreset()` === `'mapbox_all'`. A second identical set causes no extra call.
- [ ] **Step 2: Run both, expect FAIL.**
- [ ] **Step 3: Implement** with the same listener-set pattern as the renderer-choice store in the same file.
- [ ] **Step 4: Run both, expect PASS.**
- [ ] **Step 5: Commit** `feat(maps): make the admin map preset observable`

---

### Task 3: Provider loads Google only when something uses it

**Files:**
- Modify: `components/MapRuntimeProvider.tsx`, `components/GoogleMapsLoader.tsx` (doc comment only)
- Test: `tests/browser/mapRuntimeProviderStandalone.browser.test.ts` (create)

**Interfaces:**
- Consumes: `usesGoogle`, `isRendererLockedByPreset` (Task 1); `subscribeToRuntimeMapPreset`, `getRuntimeMapPresetSnapshot` (Task 2); `loadPublicAiRuntimeSettings`.
- Produces:
  - `GoogleMapsContextType` gains `disabled: boolean`: true when `!usesGoogle(runtime.effectiveSelection)`
  - `MapRuntimeContextType` gains `presetSettled: boolean` and `rendererLocked: boolean`
  - `MAP_PRESET_SETTLE_TIMEOUT_MS = 3000` (exported)

Behaviour:
- The runtime memo also depends on the preset store via `useSyncExternalStore`.
- When `isRendererLockedByPreset(requestedPreset)` is true, the traveller's `rendererChoice` is ignored (the admin cookie still wins).
- The provider calls `loadPublicAiRuntimeSettings()` once on mount. `presetSettled` turns true when it resolves, when it rejects, or after `MAP_PRESET_SETTLE_TIMEOUT_MS`.
- When `disabled`, `GoogleMapsApiGate` renders children bare. No `loadError` is set for a missing or invalid key, and no `gm_authFailure` is installed.

- [ ] **Step 1: Write the failing tests** (stub `VITE_MAP_RUNTIME_PRESET`, an invalid Google key `AIzaBAD…` of valid shape, and a Mapbox token):
  - `'mapbox_all loads no Google script and reports no load error'`: render `GoogleMapsLoader` with a probe child. Expect no `script[src*="maps.googleapis.com"]` in the document, `useGoogleMaps()` → `{ isLoaded: false, loadError: null, disabled: true }`, and `window.gm_authFailure` undefined.
  - `'a saved google renderer choice is ignored under mapbox_all'`: `setMapRendererChoice('google')`; expect `runtime.effectiveSelection.renderer === 'mapbox'`, `rendererLocked === true`, and no Google script.
  - `'switching the admin preset re-resolves without a reload'`: start on `google_all`, `setRuntimeMapPreset('mapbox_all')`; expect the probe to read `disabled: true`.
  - `'presetSettled turns true after the timeout when settings never answer'`: fake timers; a never-resolving RPC; advance 3000 ms.
- [ ] **Step 2: Run, expect FAIL:** `pnpm vitest run --project browser tests/browser/mapRuntimeProviderStandalone.browser.test.ts`
- [ ] **Step 3: Implement.** Keep `children` at one fixed depth (see the comment in the provider about remounts).
- [ ] **Step 4: Run, expect PASS.** Also run `tests/browser/mapRuntimeProviderTreeStability.browser.test.ts`, which must stay green.
- [ ] **Step 5: Commit** `feat(maps): skip the Google script when the runtime needs none`

---

### Task 4: Camera adapter

**Files:**
- Create: `components/maps/tripMapCamera.ts`
- Test: `tests/unit/tripMapCamera.test.ts`

**Interfaces:**
- Produces:

```ts
export interface TripMapCamera {
  fitBounds(points: Array<{ lat: number; lng: number }>, padding: number | { top: number; right: number; bottom: number; left: number }, options?: { maxZoom?: number; animate?: boolean }): void;
  panTo(point: { lat: number; lng: number }, options?: { zoom?: number; animate?: boolean }): void;
  getZoom(): number | null;
  setZoom(zoom: number): void;
  containsPoint(point: { lat: number; lng: number }): boolean;
  onIdle(listener: () => void): () => void;
  onZoom(listener: (zoom: number) => void): () => void;
  resize(): void;
}
export const createGoogleTripMapCamera: (map: google.maps.Map) => TripMapCamera;
export const createMapboxTripMapCamera: (map: mapboxgl.Map) => TripMapCamera;
```

  Mapbox `onIdle` maps to `'idle'` and `onZoom` to `'zoom'`. `fitBounds` with 0 points is a no-op; with 1 point it becomes `panTo` at the provider tuning's city zoom (`getTripMapProviderTuning`).

- [ ] **Step 1: Write the failing tests** with fake map objects (records of calls):
  - `'mapbox fitBounds builds LngLatBounds from points in lng,lat order and passes padding'`
  - `'fitBounds with no points does nothing'` (both adapters)
  - `'fitBounds with one point pans instead'` (both)
  - `'mapbox onZoom reports map.getZoom() and unsubscribes'`
  - `'google containsPoint reads getBounds().contains'`
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** The Google side lifts the existing logic from `runFitBounds` (`components/ItineraryMap.tsx:564-588`). The Mapbox side follows `MapboxTesterMapLayer` in `components/admin/AdminAirportTesterMap.tsx:246-252`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat(maps): add a provider-neutral trip map camera`

---

### Task 5: Standalone Mapbox mode in the trip map

**Files:**
- Modify: `components/maps/MapboxBasemapSync.tsx`, `components/ItineraryMap.tsx`
- Test: `tests/browser/itineraryMapStandaloneMapbox.browser.test.ts` (create), `tests/browser/mapboxBasemapSync.browser.test.ts`

**Interfaces:**
- Consumes: `TripMapCamera`, `createMapboxTripMapCamera`, `createGoogleTripMapCamera` (Task 4); `useGoogleMaps().disabled` (Task 3); `MapServiceImplementation` (Task 1).
- Produces:
  - `MapboxBasemapSyncProps.googleMap` stays nullable.
  - New `standalone?: boolean`: no Google sync, owns the camera.
  - New `introBounds?: Array<{ lat: number; lng: number }>`: the globe-intro target in standalone mode, used instead of `readGoogleCameraTarget`.

Behaviour in `ItineraryMap` when `isStandaloneMapbox = runtime.effectiveSelection.renderer === 'mapbox' && disabled`:
- `<GoogleMap>` and `ItineraryMapInstanceBridge` are not rendered.
- `mapInitialized` turns true from `onSurfaceReadyChange(true)`.
- A `cameraRef: TripMapCamera | null` is set from the Mapbox map (standalone) or the Google map (otherwise). Every camera call listed in the spec goes through `cameraRef`:
  - `runFitBounds` and `scheduleFitWhenViewportReady`;
  - city-focus framing and activity pan/zoom;
  - recenter on user;
  - the zoom listener feeding `mapZoomLevel`;
  - the `ResizeObserver`;
  - the `idle` in-view check.
- No `window.google.maps.*` on the Mapbox path:
  - build the `SymbolPath` arrow icon only inside the Google branch of `drawRoutePath` / `drawFallbackLegVisual`;
  - replace the `TravelMode` lookup with the app's own transport-mode value.
- `drawRoutes`: when `runtime.effectiveSelection.routes === 'none'`, draw straight legs directly. No `loadGoogleRouteRuntime`, no warning, no `ROUTE_CACHE` write.
- The Geocoder focus query is skipped when `locationSearch !== 'google'`.
- A Mapbox load error in standalone mode sets the error overlay. It does not fall back to Google.

- [ ] **Step 1: Write the failing tests:**
  - `mapboxBasemapSync.browser.test.ts` › `'standalone mode creates the map without a Google map'`: `googleMap={null} standalone`. Expect `onMapReadyChange` to be called with a map.
  - `itineraryMapStandaloneMapbox.browser.test.ts`, with `window.google` deleted, the `mapbox_all` preset and a mocked mapbox-gl module (reuse the mock in `mapboxOverlayMarkerRemoval.browser.test.ts`):
    - `'renders a Mapbox map and no "Loading map…" once the surface is ready'`. This is the regression for the production incident.
    - `'draws one straight line per leg and never imports Google routes'`
    - `'fits the camera to the trip'`: one `fitBounds` call with all city points.
    - `'shows activity markers after zooming past the gate'`: emit a `zoom` event above the gate and expect activity marker elements.
    - `'a one-city trip pans instead of fitting and still becomes ready'`. This covers Review Focus 4.
    - `'a zero-city trip becomes ready without camera calls'`. This also covers Review Focus 4.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `MapboxBasemapSync` standalone mode first, then `ItineraryMap`.
- [ ] **Step 4: Run, expect PASS.** Also run the existing map suites, which must stay green:
  - `pnpm vitest run --project browser tests/browser/itineraryMap* tests/browser/mapbox* tests/browser/google* tests/browser/mapRenderTarget.browser.test.ts`
  - `pnpm vitest run tests/unit/itineraryMap*`
- [ ] **Step 5: Commit** `feat(maps): run the trip map on Mapbox without Google`

---

### Task 6: Google map that never initializes shows an error

**Files:**
- Modify: `components/ItineraryMap.tsx`
- Test: `tests/browser/itineraryMapControls.browser.test.ts` (or a sibling file)

**Interfaces:**
- Produces: `MAP_INIT_TIMEOUT_MS = 15000` (exported from `ItineraryMap.tsx`).

- [ ] **Step 1: Write the failing test** `'a Google map that never initializes ends on an error, not a spinner'`: `google_all`, a stub `google.maps` whose `Map` never fires the instance bridge, fake timers. Advance 15000 ms; expect the text `Error loading map` and no `Loading map…`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement:** a timer that starts when the Google canvas is rendered and is cleared when `mapInitialized` turns true. It sets a local error: `new Error('Google Maps did not start (check the API key)')`. Only applies when not standalone.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `fix(maps): stop spinning when Google Maps never starts`

---

### Task 7: Mapbox city search

**Files:**
- Create: `shared/mapboxCityLookup.ts`
- Modify: `services/locationSearchService.ts`, `components/AddCityModal.tsx`
- Test: `tests/unit/mapboxCityLookup.test.ts` (create), `tests/browser/addCityModal.browser.test.ts`

**Interfaces:**
- Produces:
  - `searchMapboxCitySuggestions(query: string, options: { accessToken: string; language?: AppLanguage; maxResults?: number; fetchImpl?: typeof fetch }): Promise<CityLookupSuggestion[]>`
  - `resolveMapboxCitySuggestion(query: string, options: { accessToken: string; language?: AppLanguage; fetchImpl?: typeof fetch }): Promise<CityLookupSuggestion | null>`
  - Request: `GET https://api.mapbox.com/search/geocode/v6/forward?q=<query>&types=place&limit=<n>&language=<lang>&access_token=<token>`
  - Mapping per feature:
    - `id` = `properties.mapbox_id`;
    - `name` = `properties.name`;
    - `label` = `properties.full_address ?? properties.place_formatted`;
    - `coordinates` = `{ lat: properties.coordinates.latitude, lng: properties.coordinates.longitude }`;
    - `countryName` = `properties.context.country.name`;
    - `countryCode` = `properties.context.country.country_code` upper-cased.
  - On a non-OK response or a network error: `[]` / `null`.

- [ ] **Step 1: Write the failing tests:**
  - `mapboxCityLookup.test.ts`:
    - `'builds the v6 forward request for places'` asserts the URL params;
    - `'maps a feature to a CityLookupSuggestion'`;
    - `'returns [] on HTTP 401'`;
    - `'returns null when nothing matches'`. Covers Review Focus 5.
  - `addCityModal.browser.test.ts` › `'adds a city through Mapbox with no Google loaded'`: `mapbox_all`, no `window.google`, mocked fetch. Typing "Kapstadt" shows a suggestion; picking it calls `onAdd('Kapstadt', -33.92, 18.42)`. The typed-name path also resolves.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
  - `locationSearchService` dispatches on `'mapbox'` to the new functions with `getMapboxAccessToken()`. Hotel search stays Google-only.
  - `AddCityModal` treats search as ready when `locationSearch === 'mapbox' || isLoaded`. Today it gates on `isLoaded` at lines 136, 166, 248 and 281.
- [ ] **Step 4: Run, expect PASS.** `tests/unit/addCityModalPlacesMigration.test.ts` and `tests/unit/cityLookup.test.ts` must stay green.
- [ ] **Step 5: Commit** `feat(maps): search cities with Mapbox when Google is off`

---

### Task 8: Surfaces with search off, and the locked renderer option

**Files:**
- Modify:
  - `components/DetailsPanel.tsx` (city/activity search ~493/525, hotels ~1144)
  - `services/activityLocationResolver.ts`
  - `components/maps/MapCustomizeModal.tsx` (renderer field ~338-350)
  - `pages/BlogPostPage.tsx` (~421-424): use the existing iframe-embed fallback when `disabled`, as it already does on `loadError`; otherwise the blog map would spin
  - `locales/*/` in the namespaces those components already use
- Test: `tests/unit/detailsPanelPlacesSearch.test.ts`, `tests/browser/mapCustomizeModal*.browser.test.ts` (existing file, or create one)

**Interfaces:**
- Consumes: `useGoogleMaps().disabled`, `useMapRuntime().rendererLocked`, `runtime.effectiveSelection.locationSearch`.
- Produces two new i18n keys:
  - `placeSearchUnavailable`, draft EN: "Place search is unavailable right now." DE: "Die Ortssuche ist gerade nicht verfügbar."
  - `renderer.lockedToMapbox`, draft EN: "This site is using Mapbox right now." DE: "Diese Seite nutzt gerade Mapbox."

- [ ] **Step 1: Owner sign-off.** Show the owner both EN/DE drafts and wait for approval or edits. Do not continue until the copy is signed off.
- [ ] **Step 2: Write the failing tests:**
  - `'activity and hotel search show the unavailable notice under mapbox_all'`: no spinner element, notice text present;
  - `'activityLocationResolver resolves nothing and requests nothing when search is not google'`;
  - `'the Google renderer option is disabled with the locked note under mapbox_all'`;
  - `'a blog post map uses the embed fallback when Google is disabled'`.
- [ ] **Step 3: Run, expect FAIL.**
- [ ] **Step 4: Implement.** Add the keys to all 11 locales (English text as the fallback for locales other than EN and DE), then run `pnpm i18n:validate`.
- [ ] **Step 5: Run the tests, expect PASS.**
- [ ] **Step 6: Commit** `feat(maps): say when place search is off and lock the renderer to Mapbox`

---

### Task 9: Admin settings tell the truth about presets

**Files:**
- Modify: `pages/AdminGlobalSettingsPage.tsx:55-71, 342-356`
- Test: `tests/browser/admin/adminGlobalSettingsPage.browser.test.ts`

**Interfaces:**
- Consumes: `getGoogleMapsApiKey()` (`utils`), `getMapboxAccessToken()`.
- Produces: the preset notes, verbatim:
  - google_all: "Google draws the map and answers routing, place search and the preview images. Needs a Google key."
  - mapbox_visual_google_services: "Mapbox draws the map and the preview images; routing and place search use Google. Needs a Google key and a Mapbox token."
  - mapbox_all: "Mapbox only — Google is never loaded. Routes are straight lines, city search uses Mapbox, activity and hotel search are off. Needs a Mapbox token."
  - Status line under the select: "This deploy: Google key {configured|not configured} · Mapbox token {configured|not configured}. Configured means set at build time, not checked to work."
  - Warning (shown with `Badge` or the page's existing warning style) when the selected preset needs a missing key: "The selected provider needs a {Google key|Mapbox token} that this deploy does not have."

- [ ] **Step 1: Write the failing tests:**
  - `'shows which keys this deploy has'`;
  - `'warns when google_all is chosen without a Google key'`;
  - `'mapbox_all note says Google is never loaded'`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat(admin): explain map presets and show configured keys`

---

### Task 10: Edge previews skip Google when routes are off

**Files:**
- Modify: `netlify/edge-functions/trip-map-preview.ts` (~551, 749), `netlify/edge-lib/trip-og-data.ts` (~998-1076)
- Test: `tests/unit/tripMapPreviewEdge.test.ts`, `tests/unit/tripOgVideoMap.test.ts`

Behaviour: when the resolved `routes` is not `'google'`, pass an empty Google key into route building. Mapbox Directions on the server stay allowed in previews, because they already work with the token. *(Planner's call within the spec's "do not try Google".)* OG realistic routes that need Google fall back to straight lines.

- [ ] **Step 1: Write the failing tests:**
  - `'mapbox_all preview never calls Google Directions'`: a fetch spy asserts no `maps.googleapis.com` URL;
  - `'OG map under mapbox_all draws without the Google key'`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat(maps): keep previews off Google when routes are off`

---

### Task 11: Release note, gates, PR

**Files:**
- Create: `content/updates/<next-file>.md` per `docs/UPDATE_FORMAT.md`, `status: draft`
- Modify: `docs/MAPS_INTEGRATION_WORKFLOW.md` (one section on `mapbox_all` and `usesGoogle`)

- [ ] **Step 1: Write the release note.** One visible line, for example: "🗺️ [Improvement] Trip maps keep working on Mapbox while Google Maps is unavailable." It also gets `- [ ] [Internal]` lines for the preset and admin changes. Run `pnpm updates:validate`.
- [ ] **Step 2: Run** `pnpm typecheck` (0 errors), `pnpm test:core`, `pnpm storage:validate`, then `pnpm ci:local` in the background. All must pass.
- [ ] **Step 3: Open the PR.**
  - Body via `--body-file`.
  - List the new `tests/**` files.
  - State the rollout steps below as pending, and the copy sign-off as done.
- [ ] **Step 4: Verify on the deploy preview,** with the preview's `mr` override set to `mnmm`:
  - the draft trip page shows a Mapbox map with straight lines;
  - the network shows no `maps.googleapis.com` request;
  - add-city finds "Kapstadt".

### Rollout (after merge, owner confirms each production change)

1. Set the Netlify env var `VITE_MAP_RUNTIME_PRESET=mapbox_all` on `travelflowapp`. Run `netlify status` first; it must read `travelflowapp`.
2. Confirm the merge commit's production deploy reaches `ready` (`netlify api listSiteDeploys`). If it was built before step 1, start one with `createSiteBuild`.
3. Set the admin preset to "Mapbox for everything".
4. Verify on `https://travelflowapp.netlify.app/draft/drf_OhID3iOWYEny8ApePUD7Xyne`: Mapbox map, no Google requests, no console errors.
5. Publish the release note.
