# External Planning Imports: Google Maps, Screenshots, and PDFs

## Status
Open issue: [#347](https://github.com/chrizzzly87/travelflow/issues/347)

## Objective
Let users start trip planning from the messy artifacts they already have, including Google Maps lists, screenshots, PDFs, and pasted trip notes.

## Why
- Mindtrip is stronger on AI-native import surfaces today.
- Many users collect travel intent before they ever open a planner.
- TravelFlow already has the AI and planner layers needed to turn loose artifacts into structured itineraries if ingestion exists.

## Scope
1. Supported imports
- Google Maps saved places or pasted place lists.
- Uploaded screenshots of travel inspiration, notes, or schedules.
- Uploaded PDFs with itinerary or planning content.
- Free-text paste from notes, chats, or blogs.

2. Extraction pipeline
- Identify candidate places, dates, bookings, and constraints.
- Surface extraction confidence and unresolved fields.
- Preserve the original artifact for review and retry.

3. Review workflow
- Show extracted places and trip signals before plan generation.
- Let users approve, discard, or edit extracted items.
- Convert approved items into trip preferences, destination seeds, or planner items.

4. Planner and create-trip integration
- Allow imports to prefill create-trip wizard fields.
- Support “build trip from imports” as a first-run entry point.
- Keep imported sources attributable for later editing and QA.

5. Analytics
- Track import type, extraction confidence, approval rate, and generation success from imported inputs.

## Non-Goals
- Full Gmail or Google Maps OAuth sync in V1.
- Continuous background refresh of imported sources.
- Arbitrary web scraping beyond user-provided artifacts.

## Acceptance Criteria
- Users can upload or paste supported artifact types and review extracted planning signals before trip creation.
- Approved imports can prefill create-trip or attach structured inputs to the planner.
- Original artifacts remain accessible for support and re-parse flows.
- Regression coverage exists for extraction review and downstream prefill behavior.

## Suggested Labels
- `enhancement`
- `priority:high`
- `area:integrations`
- `area:planner`
- `type:feature`
- `effort:large`
