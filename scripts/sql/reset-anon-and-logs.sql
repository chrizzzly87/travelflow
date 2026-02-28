-- Admin reset helper (run in Supabase SQL editor or with psql)
-- Keeps trip version snapshots by default.

select *
from public.admin_reset_anonymous_users_and_logs(
  p_delete_anonymous_users => true,
  p_delete_profile_user_events => true,
  p_delete_trip_user_events => true,
  p_delete_admin_audit_logs => true,
  p_delete_trip_versions => false
);
