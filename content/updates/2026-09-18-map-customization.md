---
id: rel-2026-09-18-map-customization
version: v0.181.0
title: "Make the map yours"
date: 2026-09-19
published_at: 2026-09-19T13:38:17Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Pick the map you want to look at, tune what it shows, and tap a city to see that city — framed on your own plans, with the rest of the journey out of the way until you want it back."
---

## Changes
- [x] [New feature] 🗺️ Choose which map you look at. Switch between Google Maps and Mapbox and the map changes under you, with no reload and nothing lost.
- [x] [New feature] 🎛️ A proper customize panel, on your phone as well as your desktop. It never covers the map, so you change something and watch the map answer.
- [x] [Improved] 🔍 Tapping a city now frames that city around the places you actually planned there, instead of dropping you at one fixed zoom that was too close for a big city and too far for a small one.
- [x] [Improved] 🧹 While you are looking at one city, the other pins and the lines between them step out of the way, so you can read that city's activities without the whole journey drawn on top.
- [x] [Improved] ↩️ One tap on "Show whole journey" brings everything back. Tapping empty map, pressing Escape or pulling the day panel down does the same.
- [x] [Improved] 📋 The day panel on your phone now slides all the way down, so you can see your whole route without closing anything.
- [x] [New feature] 🧭 Tell us whether you prefer Google Maps or Apple Maps and your favourite goes first everywhere we offer to open a place.
- [x] [New feature] 🌅 Set the map's base, its colour and its light separately — including dawn and dusk, which the old fixed styles could never give you. The six named looks are still there as one-tap shortcuts.
- [x] [New feature] 🏔️ Turn on a curved globe, raised terrain, 3D buildings or a tilted camera when you want the trip to feel like a journey rather than a diagram.
- [x] [New feature] 🏷️ Decide what the map shows you: place names, street names, station names, points of interest, roads, footpaths, region borders, city names and activity pins.
- [x] [New feature] 🚦 Live traffic and transit lines, for working out whether a city day actually holds together.
- [x] [New feature] 🎨 Route lines can be thin, normal or thick, solid or dashed, with or without direction arrows.
- [x] [New feature] 🕰️ Fade the days you have already had, so the rest of the trip reads first.
- [x] [Fixed] 🎚️ Tilt and line thickness were sliders whose handle was invisible against the panel. They are now labelled steps you can actually see and hit.
- [x] [Improved] 🔀 Controls that need a particular map provider now offer to switch you to it, instead of just telling you they are unavailable.
- [x] [Improved] 💾 Each trip remembers how you set its map up, so a trip someone shares with you opens looking the way they left it. Save a setup as your own default and new trips start there.
- [x] [Improved] 📤 Copy a map setup to your clipboard to reuse it or pass it on.
- [ ] [Internal] `shared/mapPreferences.ts` resolves trip settings, the user default and app defaults into one `ResolvedMapPreferences`; the pre-existing flat `IViewSettings` fields keep their homes and readers, and everything new lives in a nested `mapCustomization` object. Nothing migrates.
- [ ] [Internal] `MapRuntimeProvider` no longer freezes its resolution in `useMemo(…, [])`; the renderer choice is fed to `resolveMapRuntime` as a `selection.renderer` partial so existing capability gating, availability fallback and warnings are reused. The admin cookie override still wins.
- [ ] [Internal] `components/maps/tripMapCityFraming.ts` replaces the constant `selection.cityFocusZoom` with a pure bounds resolver — minimum span, zoom clamp, and a 75km cut-off that keeps day trips out of a city's frame.
- [ ] [Internal] `TripMobileSheetSnap` gains a `hidden` snap; collapsing to it clears the selection, which is what made a collapsed sheet feel stuck on one city.
- [ ] [Internal] The six `MapStyle` values were only ever `theme` × `lightPreset` over two base styles; `buildMapboxStyleFromAxes` builds from the axes directly and `resolveMapStyleFromAxes` maps them back to the nearest named style for Google, which renders from six inline style arrays and has no axis equivalent. Legacy trips are decomposed on read via `MAP_STYLE_TO_AXES`, so nothing migrates.
- [ ] [Internal] Google cannot tilt here at all: tilt needs a vector map with a Cloud `mapId`, and this map is raster-styled by the inline `MAP_STYLES` arrays. The disabled controls now carry an inline provider switch rather than a passive note.
- [ ] [Internal] Both sliders replaced by `MapSegmentedControl` (real radios, so arrow keys and screen readers work). The shared `ui/slider.tsx` thumb was a 16px white disc with a 1px border — invisible at a minimum value on a white panel, worse at the 50% disabled opacity; enlarged and given a solid ring for its remaining callers.
- [ ] [Internal] Preset chips are CSS gradients, not Static Images renders: the Static Images API cannot apply a Standard style's `theme`/`lightPreset`, so a thumbnail would depict a different map from the preset it labels.
- [ ] [Internal] Stay pins were cut rather than shipped inert — `hotels` is never rendered as map markers, so the toggle would have controlled nothing.
- [ ] [Internal] `buildMapboxStyleConfig` and `applyMapboxTripVisualPolish` take detail overrides; turning roads off also drops pedestrian roads and sweeps road geometry, and keeping region borders suppresses the style's own country borders since the tileset overlay draws them.
- [ ] [Internal] Terrain uses a lazily added `raster-dem` source; tilt is applied with `setPitch` rather than a style reload, which would flash the basemap on every slider drag.
- [ ] [Internal] The personal default is device-level. Syncing it needs a `map_customization` column on `user_settings`; adding it to the upsert before the column exists would break saving every other user setting in production.
- [ ] [Internal] Apple is a deep-link handoff, not a renderer. MapKit JS is written up as a follow-up with its credential cost in `docs/superpowers/specs/2026-09-18-map-provider-customization-design.md`.
- [ ] [Internal] Copy added to all nine active locales under `tripView.mapCustomize`.
