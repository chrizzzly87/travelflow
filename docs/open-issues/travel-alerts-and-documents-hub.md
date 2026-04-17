# Travel Alerts and Documents Hub

## Status
Open issue: [#344](https://github.com/chrizzzly87/travelflow/issues/344)

## Objective
Add a trip prep and live-ops surface for storing travel documents, surfacing time-sensitive reminders, and preparing users for departure without forcing them into a separate app.

## Why
- TripIt is stronger once the trip is booked because it owns the operational reminders layer.
- TravelFlow already has trip context, trip dates, and timeline semantics, which makes it a natural place for document status and alerts.
- This increases retention close to departure and creates a clearer premium value proposition.

## Scope
1. Document vault
- Store uploaded trip documents and passes.
- Organize by trip and document type.
- Support quick-open access inside trip view and profile trip surfaces.

2. Prep and reminder model
- Track document expiry and required travel prep tasks:
  - passport expiry
  - visa reminder
  - check-in reminder
  - accommodation check-in note
  - transfer and departure reminders
- Keep reminder state durable per trip.

3. Alert surface
- Add a trip-level readiness summary with upcoming reminders.
- Show severity tiers: info, needs attention soon, urgent.
- Allow dismiss, snooze, and complete states.

4. Planner integration
- Link alerts to concrete planner items or trip dates where relevant.
- Keep documents and alerts visible without overwhelming the map/timeline workspace.

5. Analytics
- Track reminder creation, completion, snooze, and document-open behavior.

## Non-Goals
- Real-time airline status APIs in V1.
- In-app check-in or boarding-pass wallet integrations.
- Shared-family document management in V1.

## Acceptance Criteria
- Users can attach documents to a trip and reopen them later from trip surfaces.
- Reminder rules create visible prep states before departure.
- Users can complete or snooze reminders without duplicate noise.
- Regression coverage exists for reminder lifecycle and document-trip attachment behavior.

## Suggested Labels
- `enhancement`
- `priority:medium`
- `area:integrations`
- `area:planner`
- `type:feature`
- `effort:large`
