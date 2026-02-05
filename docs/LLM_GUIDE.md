# TravelFlow LLM Guide (Compact)

This doc is a compact, structured overview of the app to help future agents make safe, consistent changes.

**Project Overview**
- App type: Single-page travel planner with timeline + map + print/list views.
- Core data model: `ITrip` with `ITimelineItem[]` for cities, travel, activities.
- Primary view: `components/TripView.tsx`.
- URL-encoded persistence: `utils.ts` (`compressTrip`, `decompressTrip`) used by `App.tsx`.

**Key Files**
- `App.tsx`
- `components/TripView.tsx`
- `components/Timeline.tsx`
- `components/VerticalTimeline.tsx`
- `components/TimelineBlock.tsx`
- `components/ItineraryMap.tsx`
- `components/DetailsPanel.tsx`
- `components/PrintLayout.tsx`
- `utils.ts`
- `types.ts`
- `data/exampleTrips.ts`

**Data Model**
- `types.ts`
- `ITimelineItem.type`: `city | activity | travel | travel-empty`
- City items carry `coordinates`, `color`, `duration`, `startDateOffset`.
- Travel items carry `transportMode`, `duration`, `startDateOffset`.
- Activities have `activityType`, `startDateOffset`, `duration`.

**URL Persistence (Important)**
- Always persist view state changes in the URL via `compressTrip(trip, viewSettings)` in `App.tsx`.
- `TripView` calls `onViewSettingsChange(settings)` to update URL.
- If you add new view settings, update:
  - `IViewSettings` in `types.ts`
  - `TripView` state initialization
  - URL compression (handled by `compressTrip` in `utils.ts`)
  - URL usage in `App.tsx` (`onViewSettingsChange`)
- LocalStorage is used for some defaults, but URL should remain the source of truth for shareability.

**TripView Layout**
- Horizontal layout: timeline left, map right.
- Vertical layout: map top, timeline bottom.
- Timeline view modes:
  - `horizontal` timeline in `Timeline.tsx`
  - `vertical` timeline in `VerticalTimeline.tsx`
- Controls overlay for zoom and timeline view toggle.

**Timeline Behavior**
- Resizing a city shifts later items based on the drag start snapshot.
- Logic located in `Timeline.tsx` and `VerticalTimeline.tsx`.
- If modifying resize logic, keep:
  - `dragStartItemsRef` baseline snapshot
  - `diff = newDuration - dragState.originalDuration`
  - Shift later items against `dragState.originalOffset + dragState.originalDuration`
  - Boundary epsilon to move travel attached at city end
- City “fill” actions:
  - Timeline hover button: `TimelineBlock.tsx`
  - Details panel button: `DetailsPanel.tsx`
  - Handler: `handleForceFill` in `TripView.tsx`

**Map Behavior**
- `components/ItineraryMap.tsx` uses Google Maps API.
- Default map style is `standard`, but user can change.
- Pins are colored by city and highlight selected city.
- Routes draw directional arrow and transport icon at midpoint.
- Travel mode icons are consistent with timeline `transportMode`.

**Print/List View**
- `components/PrintLayout.tsx` renders:
  - Calendar view
  - Map
  - Detailed per-city itinerary with daily activities and notes

**Common Pitfalls**
- Do not break URL persistence of view settings.
- Changes to timeline resizing can introduce drift if not based on drag start snapshot.
- Map pins should always reflect city color and selection state.
- Transport icons and lines should stay aligned with travel items.

**Agent Checklist for UI Changes**
1. Update `IViewSettings` if new view state is added.
2. Ensure URL encoding/decoding includes new state.
3. Keep localStorage default as fallback only.
4. Ensure layout-specific changes handle both horizontal and vertical modes.
5. Confirm selection and hover styles are visible against existing backgrounds.
