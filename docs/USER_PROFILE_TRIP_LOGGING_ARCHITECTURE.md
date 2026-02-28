# User, Profile, Trip Ownership, and Audit Logging

## Purpose
This document is the operational source of truth for:
- who owns trips and what is allowed to be shown on user/profile surfaces,
- how authenticated vs anonymous sessions are handled,
- which user/admin actions are persisted as logs,
- where those logs are shown in admin UI.

## Ownership and Visibility Model
- `trips.owner_id` is the canonical ownership field.
- Authenticated profile surfaces must only render trips where `trips.owner_id = current_user_id`.
- Public/profile read access does not imply ownership and must never be persisted into personal local trip storage.
- Admin fallback access can read non-owned trips for support/debug, but is read-only unless explicit admin override is enabled.

## Session and Sync Rules
- Read/bootstrap flows use `ensureExistingDbSession()` (no anonymous auto-sign-in side effects).
- Write flows (`upsert`, `archive`, `create version`, etc.) still require an authenticated DB session.
- Simulated-login debug mode is auto-cleared when a real non-anonymous session is present.
- Authenticated profile sync replaces local trip cache with DB-owned rows (no local merge precedence for authenticated users).

## Anonymous to Registered Ownership
- Anonymous OAuth upgrades use one-time asset claim transfer flow:
  - create claim in anonymous session,
  - consume claim after real authenticated callback,
  - transfer trip ownership and user-event ownership to the target account,
  - expire stale claims and purge claimed anonymous users later.

## Logging Data Model
- `public.admin_audit_logs`
  - immutable admin actor actions (admin-side operations).
- `public.profile_user_events`
  - user profile-level actions (for example `profile.updated`, `trip.archive_failed`).
- `public.trip_user_events`
  - user trip-level lifecycle/actions (for example `trip.created`, `trip.updated`, `trip.archived`, `trip.share_created`).

## Admin Surfaces and Limits
- Admin Users drawer (`/admin/users`):
  - user change log shows latest 20 entries.
- Admin Audit page (`/admin/audit`):
  - mixed timeline (admin + user actions),
  - page size 50 with offset paging,
  - actor filters (`admin`, `user`),
  - target/action filters and date range filtering.

## Current User Action Taxonomy
- Primary trip actions:
  - `trip.created`
  - `trip.updated`
  - `trip.archived`
  - `trip.share_created`
  - `trip.archive_failed`
- Profile actions:
  - `profile.updated`
- Admin actions remain in `admin_audit_logs` with `admin.*` action namespace.

## Trip Update Diff Semantics
- Lifecycle-style trip updates use before/after metadata pairs (status/title/public visibility/source kind/expiry).
- Version-commit trip updates (itinerary edits) attach timeline-level metadata under `timeline_diff`:
  - `transport_mode_changes`
  - `deleted_items`
  - `added_items`
  - `updated_items`
  - `counts`
- Admin diff builders ignore noisy after-only fields for update events to prevent misleading “Before: —” rows.

## Debugging Playbook
- User sees foreign trips:
  - verify `dbListTrips` owner filter,
  - verify profile sync replaced local cache post-auth,
  - verify no simulated-login merge remained active.
- Archive fails with ownership error:
  - validate `trip_id` owner in `trips`,
  - inspect `profile_user_events` for `trip.archive_failed` metadata.
- User trip changes missing in admin:
  - check `trip_user_events` inserts for `trip.updated`/`trip.created`/`trip.archived`,
  - confirm `admin_list_user_change_logs` returns trip union rows.

## Known Gaps and Improvement Plan

### Phase 1 (next)
- Promote timeline diff to stable typed schema version (`timeline_diff_v1`) for forward compatibility.
- Add dedicated UI renderer for timeline diff entries (transport, item delete/add/update) instead of raw JSON blocks.
- Add deterministic event correlation IDs between upsert/version/archive operations.

### Phase 2
- Introduce domain event writers per operation class:
  - `trip.city.updated`,
  - `trip.activity.updated`,
  - `trip.activity.deleted`,
  - `trip.transport.updated`,
  - `trip.segment.deleted`,
  - `trip.trip_dates.updated`,
  - `trip.visibility.updated`.
- Keep primary pill compact (`trip.updated`) and render secondary action facets from typed metadata.

### Phase 3
- Add immutable append-only event envelope with:
  - schema version,
  - actor/target IDs,
  - causation ID,
  - correlation ID,
  - source surface,
  - redaction policy for sensitive fields.
- Add async replay/forensics export pipeline for support incidents.
