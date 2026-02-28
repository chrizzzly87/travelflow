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
- Version-commit trip updates (itinerary edits) attach timeline-level metadata under `timeline_diff` and `timeline_diff_v1`:
  - `transport_mode_changes`
  - `deleted_items`
  - `added_items`
  - `updated_items`
  - `visual_changes` (map/timeline/route and other view-level commits)
  - `counts`
- Admin diff builders ignore noisy after-only fields for update events to prevent misleading “Before: —” rows.

## Snapshot vs Diff Strategy
- Canonical history remains snapshot-based in `trip_versions.data` (immutable per version row).
- Audit timelines store compact diff metadata (`timeline_diff`) for fast table rendering and filtering.
- Full forensic compare should not duplicate large snapshots inside event rows.
- Admin full-diff modal resolves snapshots on demand:
  - reads `version_id` + `previous_version_id` from event metadata,
  - fetches `before_snapshot` and `after_snapshot` from `trip_versions`,
  - renders line-level JSON diff side-by-side (before on left, after on right).
- This keeps event logs small while preserving exact snapshot compare fidelity.

## Full Diff Modal Data Contract
- New admin RPC: `admin_get_trip_version_snapshots(p_trip_id, p_after_version_id, p_before_version_id)`.
- Output:
  - `before_snapshot`, `after_snapshot`,
  - `before_view_settings`, `after_view_settings`,
  - `before_version_id`, `after_version_id`,
  - `before_label`, `after_label`,
  - version timestamps.
- Fallback behavior:
  - if no version IDs exist, admin UI compares event `before_data` vs `after_data`,
  - if neither source exists, UI shows an explicit “snapshot unavailable” notice.

## Auth Provider Crash Hardening
- Problem:
  - a rare route recovery/back-navigation sequence could render a consumer before provider context was mounted, throwing:
    - `useAuthContext must be used within AuthProvider`.
- Hardening:
  - `useAuthContext` now returns an anonymous-safe fallback value when provider context is missing,
  - logs a one-time console error for diagnostics.
- Impact:
  - prevents white-screen crash,
  - keeps auth-gated UI stable while provider tree settles.
- This was surfaced during auth/anonymous flow hardening but is primarily a React provider-tree timing safeguard.

## Supabase Anonymous Session Setting
- Recommended with current product flow: keep Supabase anonymous sign-in **enabled**.
- Reason:
  - guest journey + anonymous creation + claim-transfer to registered accounts depends on anonymous sessions.
- Guardrails in code:
  - anonymous sessions are not auto-created for read-only/profile settings sync paths,
  - ownership claim-transfer + purge tooling cleans up anonymous identities,
  - authenticated user surfaces are owner-filtered.
- If anonymous sign-in is disabled, guest-to-account migration flows must be reworked first.

## Admin Reset/Cleanup Controls
- One-shot reset function for test environments:
  - `public.admin_reset_anonymous_users_and_logs(...)`
- It can:
  - delete anonymous auth users,
  - clear user/admin log tables,
  - optionally clear trip version snapshots.
- See runbook:
  - `docs/ADMIN_LOG_AND_ANON_RESET_RUNBOOK.md`.

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

## Logging Roadmap Status (as of 2026-02-28)
- [x] Ownership hardening shipped (authenticated profile views only DB-owned trips).
- [x] Anonymous-to-registered claim transfer shipped (including OAuth callback claim handoff).
- [x] Failure logging shipped (`trip.archive_failed`) and visible in admin user drawer + global audit.
- [x] Snapshot-aware diff UX shipped with focused diff rows and full side-by-side snapshot modal.
- [x] Typed trip timeline envelope introduced (`timeline_diff_v1`) with visual-change support and backward compatibility.
- [ ] Deterministic causation/correlation identifiers are not propagated across all write paths yet.

## Remaining Implementation Plan

### Phase 1 (remaining)
- Enforce `timeline_diff_v1` as the sole write target after DB backfill window; keep `timeline_diff` compatibility reads until migration completes.
- Replace any residual raw JSON fallback rendering paths with typed field renderers only (including any remaining legacy update surfaces).
- Add deterministic correlation IDs between upsert/version/archive operations.

### Phase 2
- Introduce secondary domain event writers per operation class:
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
