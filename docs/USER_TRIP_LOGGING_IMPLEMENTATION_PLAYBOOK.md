# User + Trip Logging Implementation Playbook

## Purpose
Use this as the mandatory implementation checklist whenever code changes user, profile, or trip behavior.

## Canonical model
- `trip_versions.data` is the canonical **snapshot** history.
- `trip_user_events` / `profile_user_events` are compact timeline events.
- `timeline_diff_v1` is the active write format for trip update diffs.
- Legacy `timeline_diff` is deprecated and must neither be written nor read by new code.

## Required write paths
- Profile updates:
  - Write `profile.updated` into `profile_user_events` with before/after data and `metadata.changed_fields`.
- Trip lifecycle updates:
  - `trip.created`, `trip.updated`, `trip.archived`, `trip.share_created` in `trip_user_events`.
  - Include `metadata.correlation_id` on every write.
  - Use deterministic conventions where available (`trip-upsert-*`, `trip-version-*`) and preserve caller correlation IDs on archive flows.
- Trip version commits (`dbCreateTripVersion`):
  - Write `trip.updated` with:
    - `timeline_diff_v1`
    - `version_id` + `previous_version_id`
    - `secondary_action_codes`
    - `correlation_id`
- Failures:
  - Persist action failures (`trip.archive_failed` and generic failures) via DB functions into `profile_user_events`.

## `timeline_diff_v1` checklist
- Required keys:
  - `schema = "timeline_diff_v1"`
  - `version = 1`
  - `counts`
  - `deleted_items`, `added_items`, `updated_items`, `transport_mode_changes`, `visual_changes`
  - `truncated`
- Visual-only commits must still emit `timeline_diff_v1` with `visual_changes`.

## Secondary action facet checklist
- Write `metadata.secondary_action_codes` for `trip.updated` events.
- Keep values typed and stable (for example `trip.transport.updated`, `trip.activity.deleted`, `trip.segment.deleted`).
- Keep primary action compact (`trip.updated`); use secondary facets for filter/detail UIs.

## Admin rendering requirements
- User/admin timelines must read `timeline_diff_v1` only.
- “Show complete diff” must resolve snapshot compare from `trip_versions` when version IDs exist.

## Tests required for behavioral changes
- Add/adjust browser tests for event writer payloads in:
  - `tests/browser/dbCreateTripVersion.browser.test.ts`
  - `tests/browser/dbArchiveTrip.browser.test.ts`
- Add/adjust unit tests for admin diff/action mapping in:
  - `tests/unit/adminUserChangeLog.test.ts`
- Run `pnpm test:core` before merge.

## Related source-of-truth docs
- `docs/TIMELINE_DIFF_EVENT_CONTRACT.md`
- `docs/USER_PROFILE_TRIP_LOGGING_ARCHITECTURE.md`
