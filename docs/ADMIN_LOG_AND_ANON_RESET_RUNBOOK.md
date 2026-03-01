# Admin Reset Runbook: Anonymous Users and Logs

## Purpose
Use this runbook to reset noisy test data so you can validate ownership and audit behavior from a clean baseline.

## Scope
Function:
- `public.admin_reset_anonymous_users_and_logs(...)`

What it can clear:
- `profile_user_events`
- `trip_user_events`
- `admin_audit_logs`
- anonymous users in `auth.users` (anonymous-only identities)
- optional: `trip_versions` snapshots

## Required Permissions
- Caller must have admin permissions:
  - `users.hard_delete`
  - `audit.write`

## Recommended Test Reset (keep trip version snapshots)
```sql
select *
from public.admin_reset_anonymous_users_and_logs(
  p_delete_anonymous_users => true,
  p_delete_profile_user_events => true,
  p_delete_trip_user_events => true,
  p_delete_admin_audit_logs => true,
  p_delete_trip_versions => false
);
```

## Full Deep Reset (also clear trip version snapshots)
```sql
select *
from public.admin_reset_anonymous_users_and_logs(
  p_delete_anonymous_users => true,
  p_delete_profile_user_events => true,
  p_delete_trip_user_events => true,
  p_delete_admin_audit_logs => true,
  p_delete_trip_versions => true
);
```

## Output Columns
- `deleted_profile_user_events`
- `deleted_trip_user_events`
- `deleted_admin_audit_logs`
- `deleted_trip_versions`
- `deleted_anonymous_claims`
- `deleted_anonymous_users`

## Notes
- Deleting anonymous users cascades to anonymous-owned trips and related rows.
- Use this in staging/dev/test environments unless you explicitly intend production cleanup.
- For routine maintenance of stale claimed anonymous users (without full reset), use:
  - `public.purge_claimed_anonymous_users(...)`.
