# Timeline Diff Event Contract (`timeline_diff_v1`)

## Why this exists
- We need compact, structured trip-edit audit metadata that is stable for UI rendering and future migrations.
- Raw trip snapshots remain canonical in `trip_versions.data`; event metadata should summarize intent and key changes.

## Current rule (authoritative)
- **Write format**: `metadata.timeline_diff_v1` only.
- **Legacy read compatibility**: `metadata.timeline_diff` may still be read for old rows until legacy rows are fully retired.
- **Do not add new `timeline_diff` writes.**

## Producer and consumer
- Producer:
  - `services/dbService.ts` (`dbCreateTripVersion`) writes `timeline_diff_v1`.
- Consumer:
  - `services/adminUserChangeLog.ts` reads `timeline_diff_v1` first, then falls back to legacy `timeline_diff`.

## `timeline_diff_v1` shape
```json
{
  "schema": "timeline_diff_v1",
  "version": 1,
  "counts": {
    "deleted_items": 0,
    "added_items": 1,
    "transport_mode_changes": 1,
    "updated_items": 2,
    "visual_changes": 1
  },
  "deleted_items": [],
  "added_items": [],
  "transport_mode_changes": [],
  "updated_items": [],
  "visual_changes": [],
  "truncated": false
}
```

## Secondary action facets
- Producer also writes `metadata.secondary_action_codes` for `trip.updated` version commits.
- This is a compact, typed list for fast filtering/faceting (while `timeline_diff_v1` remains the detailed diff payload).
- Current emitted values include:
  - `trip.transport.updated`
  - `trip.activity.updated`
  - `trip.activity.deleted`
  - `trip.segment.deleted`
  - `trip.city.updated`
  - `trip.trip_dates.updated`
  - `trip.visibility.updated` (lifecycle visibility toggles)

## Visual-only edits
- Visual commits (for example map style/timeline layout changes) are represented in `visual_changes`.
- Timeline control commits are part of this set (for example `Timeline mode`, `Timeline layout`, `Zoomed in/out`).
- If older events only have `version_label` text (for example `Visual: Map view: minimal → clean`), consumer fallback parses that label into structured diff rows.

## Correlation tracing
- `trip_user_events.metadata` must include `correlation_id`.
- Archive failure metadata in `profile_user_events` (via `log_user_action_failure`) must also include `correlation_id`.
- Correlation IDs connect related write attempts across event tables for incident tracing.

## Test coverage (must keep)
- `tests/browser/dbCreateTripVersion.browser.test.ts`
  - verifies `timeline_diff_v1` writes
  - verifies no regression to legacy write format
  - verifies correlation ID presence
  - verifies timeline controls map into `visual_changes`
  - verifies secondary action facets for transport/activity/segment updates
- `tests/browser/dbArchiveTrip.browser.test.ts`
  - verifies archive and archive-failure metadata includes correlation IDs
- `tests/unit/adminUserChangeLog.test.ts`
  - verifies v1 parsing, legacy fallback parsing, and v1 precedence when both payloads exist

## Migration safety notes
- Keep legacy read fallback until you confirm all active environments no longer contain legacy-only rows.
- Remove fallback in one PR with:
  - explicit doc update here and in `docs/USER_PROFILE_TRIP_LOGGING_ARCHITECTURE.md`
  - regression tests updated to remove legacy path expectations.
