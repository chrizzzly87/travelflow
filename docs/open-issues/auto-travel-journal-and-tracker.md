# Auto Travel Journal and Tracker

## Status
Open issue: [#348](https://github.com/chrizzzly87/travelflow/issues/348)

## Objective
Extend TravelFlow beyond pre-trip planning into a privacy-aware travel memory product with automatic journaling, route recap, and relive-style output after or during a trip.

## Why
- Polarsteps leads this category today.
- TravelFlow already has itineraries, maps, dates, profile identity, and passport surfaces that can support memory loops.
- This creates a differentiated long-tail retention arc after planning is done.

## Scope
1. Journal model
- Add per-trip journal entries with date, place, text, and media hooks.
- Support quick add during a trip and recap editing later.

2. Tracking foundation
- Define optional trip progress and location-track ingestion model.
- Keep tracking explicitly opt-in with strong privacy controls.
- Support manual fallback when tracking data is absent.

3. Relive output
- Generate a recap timeline or route summary from trip progress plus journal entries.
- Reuse profile and passport surfaces where that creates a better travel-memory loop.

4. Privacy and sharing
- Clear private/public controls per trip and per journal surface.
- Separate private notes from public highlights.

5. Analytics
- Track journal creation, recap views, privacy-mode usage, and relive-share behavior.

## Non-Goals
- Continuous background tracking across the whole app in V1.
- Social feed comments in the initial release.
- Printed photo-book commerce in V1.

## Acceptance Criteria
- Users can create journal entries tied to a trip and revisit them later.
- Tracking and recap behavior remain opt-in and privacy-safe.
- A basic route or timeline recap can be generated from available trip progress data.
- Regression coverage exists for privacy behavior, journal persistence, and recap generation contracts.

## Suggested Labels
- `enhancement`
- `priority:medium`
- `area:community`
- `area:product`
- `type:feature`
- `effort:large`
