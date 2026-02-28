# User + Trip Logging Implementation Playbook

This is the guardrail doc for any future mutation work. If a change touches user or trip data, it must also update audit logging in the correct format.

## Read This First
- `docs/TIMELINE_DIFF_EVENT_CONTRACT.md`
- `docs/USER_PROFILE_TRIP_LOGGING_ARCHITECTURE.md`
- `services/dbService.ts`
- `services/adminUserChangeLog.ts`

## Non-Negotiable Rule
- Any user-facing mutation for profile or trip data must write an audit event in the same request flow.
- No silent state mutations without a corresponding log event.
- This applies to both client fallback writers and DB-native writers (`docs/supabase.sql` trigger/function paths).

## Canonical Event Model
- Primary trip actions (stable pills):
  - `trip.created`
  - `trip.updated`
  - `trip.archived`
  - `trip.share_created`
  - `trip.archive_failed`
- Profile actions:
  - `profile.updated`
- For trip update commits:
  - write `metadata.timeline_diff_v1` only (no new `timeline_diff` writes)
  - include `metadata.secondary_actions` codes for deterministic facet rendering
  - include `metadata.correlation_id`

## Snapshot + Diff Expectations
- Canonical history snapshot: `trip_versions.data`.
- Event rows should contain compact diff metadata (`timeline_diff_v1`) and not full snapshot duplication.
- Full snapshot compare is reconstructed on-demand in admin diff modal via version snapshot lookup.

## Required Metadata Keys
- Event envelope for trip/profile mutation logs:
  - `event_schema_version`
  - `event_id`
  - `event_kind`
  - `correlation_id`
  - `causation_id`
  - `source_surface`
- Trip update (`trip.updated`):
  - `trip_id`, `version_id`, `previous_version_id`, `version_label`
  - `source_kind_after`, `status_after`, `updated_at_after`
  - lifecycle rows: `start_date_before|after`, `show_on_public_profile_before|after`, `trip_expires_at_before|after`
  - `timeline_diff_v1`
  - `domain_events_v1`
  - `secondary_actions`
  - `correlation_id`
- Archive failure (`trip.archive_failed`):
  - `trip_id`, `source`, `archive_metadata`, `correlation_id`

## Secondary Action Codes
- Supported writer codes:
  - `trip.activity.added|updated|deleted`
  - `trip.transport.added|updated|deleted`
  - `trip.city.added|updated|deleted`
  - `trip.item.added|updated|deleted`
  - `trip.settings.updated`
  - `trip.visibility.updated`
  - `trip.trip_dates.updated`
  - `trip.view.updated`
- Admin consumers read `secondary_actions` first, then fallback to derived diff keys for legacy rows.

## Domain Sub-Event Payload
- `domain_events_v1` is the structured sub-event payload for `trip.updated` rows.
- Use it for strict export/query semantics while keeping one primary timeline row.
- Keep payload compact, deterministic, and capped (`truncated: true` when capped).

## Definition of Done for Mutation PRs
1. Mutation writes/updates the correct event action.
2. Metadata contract fields are present and typed.
3. `timeline_diff_v1` is used for trip updates (legacy read fallback remains consumer-only).
4. `secondary_actions` are present for new trip update rows.
5. Regression tests updated in the same PR.
6. Docs updated when taxonomy/schema behavior changes.

## Minimum Test Coverage
- `tests/browser/dbUpsertTrip.browser.test.ts`
- `tests/browser/dbCreateTripVersion.browser.test.ts`
- `tests/browser/dbArchiveTrip.browser.test.ts`
- `tests/unit/adminUserChangeLog.test.ts`
- Add a new regression test for any new mutation surface that writes an event.

## Validation Commands
- `pnpm test:core`
- `pnpm updates:validate`
- `pnpm dlx react-doctor@latest . --verbose --diff` (for substantial React/admin UI changes)

## Failure Mode Policy
- If the mutation fails, log the failure event when possible (`trip.archive_failed`) with error metadata.
- Prefer server-side failure logging first; client fallback logging is best effort.
