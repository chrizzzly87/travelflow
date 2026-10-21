-- Records that an applied proposal was taken back.
--
-- A revert restores the pre-apply trip as a new version, but nothing said so on
-- the change set: after a reload the card read `applied` again, offered no redo,
-- and the transcript could not show what had happened.

alter table public.trip_agent_change_sets
  add column if not exists reverted_at timestamptz;

alter table public.trip_agent_change_sets
  drop constraint if exists trip_agent_change_sets_status_check;

alter table public.trip_agent_change_sets
  add constraint trip_agent_change_sets_status_check
  check (status in ('pending', 'applied', 'applied_partial', 'rejected', 'stale', 'reverted'));
