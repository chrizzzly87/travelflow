# Reservation Import and Trip Ops Hub

## Status
Open issue: [#343](https://github.com/chrizzzly87/travelflow/issues/343)

## Objective
Turn TravelFlow from an itinerary generator into an itinerary plus booking operations workspace by importing reservations and normalizing them into one trip timeline.

## Why
- TripIt wins this category today with automated itinerary ingestion.
- Wanderlog is stronger on practical planning once bookings exist.
- TravelFlow already has the planner canvas and trip structure, but it still relies too much on manual booking transcription.

## Scope
1. Ingestion sources
- Forwarded booking emails.
- Uploaded PDFs and confirmation screenshots.
- Manual paste of free-text reservation details.

2. Booking normalization
- Parse common reservation types:
  - flights
  - hotels
  - trains
  - buses
  - ferries
  - activities with fixed time windows
- Store source metadata and parse confidence.
- Preserve the raw source artifact for support and re-parse flows.

3. Trip ops hub
- Show imported reservations in one trip-level operations view.
- Flag missing fields, time conflicts, and duplicate bookings.
- Let users confirm, edit, or dismiss imported items before timeline merge.

4. Planner integration
- Merge accepted reservations into the trip timeline without losing AI-generated structure.
- Protect hard-time bookings during later AI refinement or route edits.
- Expose source-aware chips or badges so imported vs generated items remain understandable.

5. Analytics and diagnostics
- Track import source, parse success, confirmation rate, edit rate, and failure reasons.
- Log parse confidence and normalized booking type for QA.

## Non-Goals
- Full airline disruption handling in V1.
- Provider account OAuth integrations in V1.
- Automatic refunds, seat-change workflows, or check-in support.

## Acceptance Criteria
- Users can import a booking source and review parsed reservations before adding them to a trip.
- Accepted reservations appear as structured planner items with durable source metadata.
- Time conflicts and parse uncertainty are visible before merge.
- Regression coverage exists for parsing, merge behavior, and source preservation.

## Suggested Labels
- `enhancement`
- `priority:high`
- `area:integrations`
- `area:planner`
- `type:feature`
- `effort:large`
