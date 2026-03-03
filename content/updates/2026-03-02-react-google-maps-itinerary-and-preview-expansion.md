---
id: rel-2026-03-02-react-google-maps-itinerary-and-preview-expansion
version: v0.78.0
title: "React Google Maps itinerary migration and trip preview expansion"
date: 2026-03-02
published_at: 2026-03-02T13:30:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Trip planner map rendering is now more stable, with clearer markers and expanded custom trip preview coverage across key surfaces."
---

## Changes
- [x] [Improved] 🗺️ Trip itinerary maps now load with more stable rendering behavior during planner interactions.
- [x] [Improved] 📍 City and transport markers now have clearer visual hierarchy so active stops and route icons are easier to read.
- [x] [Improved] 🧭 Trip preview maps on profile, trip manager, and admin surfaces now render more consistently with shared map styling.
- [x] [Improved] 🧱 Dark map route legs now use stronger light-edge contrast so paths stay visible against dark basemaps.
- [x] [Improved] 🎯 Clicking a map city pin now selects that stop, opens its details, and auto-scrolls to it in the active planner view.
- [x] [Improved] ♻️ Transport route changes now refresh without stale previous-mode overlays lingering on the map.
- [x] [Improved] 🔁 Round-trip start/end city pins now offset overlapping markers so both stop numbers stay readable.
- [x] [Improved] 🧭 Initial planner map mount now appears in-place without the first-load morph transition.
- [x] [Improved] 🎯 Fit-to-trip recenter now waits for map viewport sizing so reset zoom is more reliable after layout changes.
- [x] [Improved] 🌑 Added a new Clean (Dark) map style that keeps the low-noise map treatment while matching dark theme contrast.
- [x] [Improved] 🧱 Dark map route legs now render with a layered gap + route-colored outer edge at softer opacity so paths pop without overpowering the basemap.
- [x] [Improved] 🛣️ Dashed fallback legs on dark maps no longer render an outer edge so they stay visually distinct from realistic road routes.
- [x] [Improved] 🌙 Clean (dark) pin-adjacent city and START/END labels now use white text with dark drop-shadow contrast for readability.
- [x] [Improved] 🧷 Map text overlays now render above route lines, and START/END labels keep the accent highlight color in Clean (dark).
- [x] [Improved] 🎨 Clean (dark) START/END labels now use a lighter accent tone for better readability on dark basemaps.
- [x] [Improved] 🧩 Clean (light) pin-adjacent label shadows/colors remain on the legacy styling while Clean (dark) keeps the new contrast treatment.
- [x] [Improved] 🗺️ Route cutout border tones now align better with map background colors so layered legs look cleaner across map styles.
- [x] [Improved] 🌍 Clean (dark) now restores subtle country labels with low-contrast text for orientation without adding map noise.
- [x] [Improved] 🏙️ Map pin-adjacent labels now render city-only names instead of city-plus-country strings.
- [x] [Improved] 🧭 Map pin-adjacent labels now choose smarter anchor sides (right/left/below/above) to reduce route-line overlap in common cases.
- [x] [Fixed] 🧩 Single-city trip previews now render reliably instead of failing route-only preview assumptions.
- [ ] [Internal] 🛣️ Switched realistic route checks to the newer Google Routes API path with legacy fallback support.
- [ ] [Internal] 🧠 Added distance-based mode eligibility and bounded transit retry policy to improve route success while reducing wasted checks.
- [ ] [Internal] 🚉 Transit retries now stay in transit mode with a broader second pass instead of silently substituting driving routes.
- [ ] [Internal] 🧰 Added an explicit field mask for Routes API calls and fallback to legacy directions when Routes requests fail.
- [ ] [Internal] 🧯 Added a field-mask compatibility retry and lazy Directions fallback initialization to reduce routing warning noise.
- [ ] [Internal] 🧵 Added an async draw-session guard so stale route responses cannot re-attach old transport overlays after mode changes.
- [ ] [Internal] 🧪 Tightened route-shape validation so straight-like transit responses are treated as fallback lines instead of misleading solid realistic paths.
- [ ] [Internal] 🧹 Normalized legacy transport values when loading saved trips so reopened plans use canonical travel modes.
- [ ] [Internal] 🧷 Ignored no-op transport reselection updates to reduce redundant route refreshes and history churn.
- [ ] [Internal] 🧭 Replaced deprecated map marker constructors with OverlayView-based markers to remove legacy marker API warnings.
- [ ] [Internal] 🏨 Migrated city-panel hotel lookup from deprecated PlacesService text search to Place.searchByText.
- [ ] [Internal] 🧭 Removed legacy DirectionsService fallback and now use Routes API-only checks before straight-line fallback.
- [ ] [Internal] 🏙️ Migrated city lookup flows away from deprecated Places Autocomplete to searchByText + geocoder fallback suggestions.
- [ ] [Internal] 🧪 Local `pnpm dev` map previews now build a valid direct Static Maps URL (paths + markers) when the edge runtime is unavailable.
- [ ] [Internal] 🧪 Added regression coverage for proxy-based trip preview URL generation and single-city preview behavior.
- [ ] [Internal] 🧪 Added viewport-readiness guards and resize-triggered map sync before fit-bounds calls.
- [ ] [Internal] 🧭 Added `docs/MAPS_INTEGRATION_WORKFLOW.md` and linked agent/LLM guidance for future map features.
