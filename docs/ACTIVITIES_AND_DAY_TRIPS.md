# Activities, stays and day trips

How an activity belongs to a stay, what a day trip is, and every surface that has
to agree on both. Read this before touching activity placement, the add-activity
dialog, the map's activity layers, trip generation, the Trip Agent schemas, or
the example trips.

## Data model

All fields are optional and additive on `ITimelineItem` (`types.ts`). No
migration exists or is needed: trips are stored as JSON documents, and every
reader falls back to the old behaviour when a field is missing.

| Field | On | Meaning |
| --- | --- | --- |
| `stayCityId` | activity | Id of the `type: 'city'` item the activity belongs to. |
| `activityKind` | activity | `'day-trip'` for a day trip. Missing or `'activity'` = ordinary activity. |
| `dayTripReturnCityId` | day trip | Only when the day **ends at another stay**. Missing = back to `stayCityId`. |
| `location` / `coordinates` | day trip | The **destination** (Sintra), not the stay (Lisbon). |

"Stay" here means the city item. Hotels on a city are `hotels[]`, and the
Trip Agent calls those `stay` in `add_stay` / `update_stay`. Never put a hotel
id into `stayCityId`.

## One resolver: `shared/activityStay.ts`

Everything that asks "which stay does this activity belong to?" goes through
`resolveActivityStay`. It replaced three copies of the same date-window rule
(map framing, map markers, the mobile day plan).

1. An explicit `stayCityId` wins while that city exists **and** the activity
   still falls on one of its days, including the departure day it shares with
   the next stay (`resolveExplicitActivityStay`).
2. Otherwise the stay whose window contains `startDateOffset`, then the stay
   under way before it, then the first stay (`resolveStayForOffset`).

Rule 1's day check means dragging an activity to another stay's days re-homes it
without writing anything, and older trips without the field behave exactly as
before.

Deleting a stay removes the activities that resolve to it. Reordering stays
moves those activities with them (`utils.ts`).

## Day trips

A day trip is an activity that **leaves its stay and comes back the same day**,
for example Sintra from Lisbon, Miyajima from Hiroshima, or the Golden Circle
from Reykjavik. It is not a city stop and needs no transfer.

- **Calendar:** shown with a compass icon instead of the activity-type icon
  (`TimelineBlock`), and as a "Day trip · Destination" badge in the list and
  mobile day views (`DayTripBadge`).
- **Map:** `components/maps/tripMapDayTripModel.ts` turns each day trip into a
  descriptor. `ItineraryMap` then draws:
  - a dashed line from the stay out to the destination and back, or on to
    `dayTripReturnCityId`. It is straight, with no directions lookup.
  - a stay-coloured compass pin that is visible at **every** zoom level, unlike
    activity pins.

  Day-trip destinations widen the whole-trip fit bounds but never a single
  city's focus frame. A day trip **without destination coordinates** stays an
  ordinary activity pin at its stay, so nothing disappears from the map.
- **Ending somewhere else:** this is an edge case. In both the add dialog and
  the details panel it sits behind a collapsed "More options" disclosure, which
  only opens by itself when the option is already in use.

## Editing surfaces

- The **Activities lane** has a single hover "+" like the Cities and Transfer
  lanes. It opens the dialog on the first day of the selected stay (or the
  selected activity's stay), otherwise on day 1 (`resolveDefaultActivityDayOffset`).
- The **add dialog** (`AddActivityModal`) and the **details panel** share
  `components/tripview/ActivityPlanFields.tsx`, which holds:
  - the Activity / Day trip switch
  - Stay and Day pickers (the day is clamped into the chosen stay)
  - the destination field
  - the "ends in" option
- Adding a day trip looks up the destination position before saving, so it
  appears on the map immediately. The details panel resolves a day trip's
  position from its destination plus the stay's country, never from the stay's
  city name.
- The details panel stamps `stayCityId` only when the traveller edits
  something. Merely viewing an older trip never writes to it.

## Trip generation (AI)

- `shared/aiTripItinerarySchema.ts` has a top-level `dayTrips[]`. Each entry has
  `title`, base `cityIndex`, `dayOffsetInCity`, `duration`, `destination`,
  `lat`, `lng`, `description` and `activityTypes`, in the strict, compact and
  Gemini schemas.
- `dayTrips` is a separate list rather than nullable fields on `activities`
  because not every provider handles nullable types in strict schemas.
- Prompt rule 8 (`services/aiService.ts`, both rule sets and the strict
  contract): a single-day excursion goes into `dayTrips`, never into `cities`.
  Multi-day excursions stay cities (rule 2).
- `prepareDayTrips` (`shared/aiTripItineraryPreparation.ts`) is forgiving:
  - it coerces numeric strings
  - it clamps the day into the base stay and the duration to at most one day
  - it drops malformed entries
  - it keeps an entry without a usable position as an ordinary activity

  A bad day trip never fails or repairs a whole trip. `dayTrips` is optional at
  the root, so older drafts and repair passes still validate.
- Valid day trips join `activities` with `isDayTrip`, `destination`, `lat` and
  `lng`. All three item builders (the async worker, `services/aiService.ts` and
  the benchmark) call `buildModelActivityPlacementFields`
  (`shared/aiTripActivityPlacement.ts`). Every generated activity gets
  `stayCityId`, and a day trip gets `activityKind`, the destination and
  `coordinatesSource: 'ai'`.
- The **AI benchmark** (`shared/aiBenchmarkValidation.ts`) reports
  `dayTripCount` and `dayTripsPlaceable`. It warns when day trips were
  downgraded. Neither check blocks a run; both are visible in the admin
  benchmark validation dialog.

## Trip Agent (chat)

- The internal schema (`shared/tripAgent.ts`) accepts `activityKind`,
  `stayCityId` and `dayTripReturnCityId`, plus the resolver fields
  `coordinatesSource`, `coordinatesQuery` and `placeId`. Every apply re-parses
  the whole trip strictly, so an item field missing from this schema fails
  every proposal on any trip that has it.
- The wire schema (`shared/tripAgentWireOperations.ts`) takes `stayCityId`,
  `isDayTrip` and `dayTripReturnCityId` on `item` and `itemChanges`:
  - `isDayTrip` accepts `true` / `"true"` / `"false"`; it deliberately does not
    use `z.coerce.boolean`.
  - `isDayTrip: false` turns a day trip back into an ordinary activity.
  - An empty `dayTripReturnCityId` clears it.
- `findUnknownOperationTargets` rejects a `stayCityId` or `dayTripReturnCityId`
  that is not a city item in the resulting trip, with a hint not to use a hotel
  id.
- `read_trip_context` returns the trip through `withResolvedActivityStays`, so
  the model sees a real `stayCityId` on every activity, even on older trips.
  This is read-only. The system prompt explains stays and day trips.

## Example trips

- Templates may set `stayCityId` / `activityKind` / `dayTripReturnCityId` with
  **template** ids. `instantiateTemplateItems` (`data/exampleTripTemplates/_validation.ts`)
  suffixes every id and every reference to one, and fills in `stayCityId` for
  activities that do not set it.
- `validateTripSchema` fails on a dangling stay reference or a day trip without
  coordinates.
- Portugal: Sintra is a day trip from Lisbon, not a stop. The card has 3 stops
  and localized city lists without Sintra. The labelled day trips in Japan,
  Southeast Asia, Iceland, Peru and Thailand are day trips.
- The static card map PNGs (`pnpm maps:generate`) are city-only, and the static
  and OG map previews do not draw day trips (see
  `docs/TRIP_MAP_PREVIEW_CACHING.md`).

## Tests

- `tests/unit/activityStay.test.ts`: the resolver, the defaults, and stay-aware
  delete and reorder.
- `tests/unit/tripMapDayTripModel.test.ts`: map descriptors, marker HTML, and
  city framing.
- `tests/unit/aiTripItineraryPreparation.test.ts` and
  `tests/unit/aiTripActivityPlacement.test.ts`: generation.
- `tests/unit/tripAgentDayTrips.test.ts`: the wire schema, target checks, the
  apply regression for resolver fields, and read context.
- `tests/unit/exampleTripDayTrips.test.ts`: every template, and the Portugal
  card.
- `tests/browser/timelineReadOnlyAddButtons.browser.test.ts`: the single lane
  "+" and its default day.
