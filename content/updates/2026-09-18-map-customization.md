---
id: rel-2026-09-18-map-customization
version: v0.176.0
title: "Make the map yours"
date: 2026-09-18
published_at: 2026-09-18T10:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Pick the map you want to look at, tune what it shows, and tap a city to see that city — framed on your own plans, with the rest of the journey out of the way until you want it back."
---

## Changes
- [x] [New feature] 🗺️ Choose which map you look at. Switch between Google Maps and Mapbox and the map changes under you, with no reload and nothing lost.
- [x] [New feature] 🎛️ A proper customize panel, on your phone as well as your desktop. It sits below the map rather than over it, so you can change something and watch the map answer.
- [x] [Improved] 🔍 Tapping a city now frames that city around the places you actually planned there, instead of dropping you at one fixed zoom that was too close for a big city and too far for a small one.
- [x] [Improved] 🧹 While you are looking at one city, the other pins and the lines between them step out of the way, so you can read that city's activities without the whole journey drawn on top.
- [x] [Improved] ↩️ One tap on "Show whole journey" brings everything back. Tapping empty map, pressing Escape or pulling the day panel down does the same.
- [x] [Improved] 📋 The day panel on your phone now slides all the way down, so you can see your whole route without closing anything.
- [x] [New feature] 🧭 Tell us whether you prefer Google Maps or Apple Maps and your favourite goes first everywhere we offer to open a place.
- [x] [New feature] 🌓 The map can follow your phone's light or dark setting, or stay on whichever you prefer.
- [x] [New feature] 🏔️ Turn on a curved globe, raised terrain or a tilted camera when you want the trip to feel like a journey rather than a diagram.
- [x] [New feature] 🏷️ Decide what the map shows you: points of interest, roads and transit, region borders, city names, activity pins — and how thick the route lines are drawn.
- [x] [Improved] 💾 Each trip remembers how you set its map up, so a trip someone shares with you opens looking the way they left it. Save a setup as your own default and new trips start there.
- [x] [Improved] 📤 Copy a map setup to your clipboard to reuse it or pass it on.
- [ ] [Internal] `shared/mapPreferences.ts` resolves trip settings, the user default and app defaults into one `ResolvedMapPreferences`; the pre-existing flat `IViewSettings` fields keep their homes and readers, and everything new lives in a nested `mapCustomization` object. Nothing migrates.
- [ ] [Internal] `MapRuntimeProvider` no longer freezes its resolution in `useMemo(…, [])`; the renderer choice is fed to `resolveMapRuntime` as a `selection.renderer` partial so existing capability gating, availability fallback and warnings are reused. The admin cookie override still wins.
- [ ] [Internal] `components/maps/tripMapCityFraming.ts` replaces the constant `selection.cityFocusZoom` with a pure bounds resolver — minimum span, zoom clamp, and a 75km cut-off that keeps day trips out of a city's frame.
- [ ] [Internal] `TripMobileSheetSnap` gains a `hidden` snap; collapsing to it clears the selection, which is what made a collapsed sheet feel stuck on one city.
- [ ] [Internal] `buildMapboxStyleConfig` and `applyMapboxTripVisualPolish` take detail overrides; turning roads off also drops pedestrian roads and sweeps road geometry, and keeping region borders suppresses the style's own country borders since the tileset overlay draws them.
- [ ] [Internal] Terrain uses a lazily added `raster-dem` source; tilt is applied with `setPitch` rather than a style reload, which would flash the basemap on every slider drag.
- [ ] [Internal] The personal default is device-level. Syncing it needs a `map_customization` column on `user_settings`; adding it to the upsert before the column exists would break saving every other user setting in production.
- [ ] [Internal] Apple is a deep-link handoff, not a renderer. MapKit JS is written up as a follow-up with its credential cost in `docs/superpowers/specs/2026-09-18-map-provider-customization-design.md`.
- [ ] [Internal] Copy added to all nine active locales under `tripView.mapCustomize`.
