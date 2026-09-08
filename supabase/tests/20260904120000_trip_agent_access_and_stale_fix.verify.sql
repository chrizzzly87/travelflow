-- Behaviour checks for migration 20260904120000, runnable against a throwaway
-- Postgres with `_trip_agent_stub_schema.sql` loaded first:
--
--   initdb -D /tmp/pgdata -U postgres --auth=trust
--   LC_ALL=C pg_ctl -D /tmp/pgdata -o "-p 55432 -h 127.0.0.1" start
--   psql -h 127.0.0.1 -p 55432 -U postgres -c "create role anon; create role authenticated; create role service_role;"
--   psql -h 127.0.0.1 -p 55432 -U postgres -f supabase/tests/_trip_agent_stub_schema.sql
--   psql -h 127.0.0.1 -p 55432 -U postgres -f supabase/migrations/20260904120000_trip_agent_access_and_stale_fix.sql
--   psql -h 127.0.0.1 -p 55432 -U postgres -f supabase/tests/20260904120000_trip_agent_access_and_stale_fix.verify.sql
--
-- Every `result` below must match the expectation in its case label.

insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

insert into public.trips(id, owner_id, status, data, updated_at)
values ('trip-live', '11111111-1111-4111-8111-111111111111', 'active', '{"updatedAt":100}'::jsonb, now());
insert into public.trips(id, owner_id, status, trip_expires_at, data)
values ('trip-expired', '11111111-1111-4111-8111-111111111111', 'active', now() - interval '1 day', '{"updatedAt":100}'::jsonb);
insert into public.trip_shares(trip_id, token, mode) values ('trip-live', 'edit-token', 'edit');
insert into public.trip_shares(trip_id, token, mode) values ('trip-live', 'view-token', 'view');

select 'owner can edit (expect t)' as case,
       public.trip_agent_can_edit('trip-live', '11111111-1111-4111-8111-111111111111') as result
union all select 'stranger cannot (expect f)',
       public.trip_agent_can_edit('trip-live', '22222222-2222-4222-8222-222222222222')
union all select 'expired trip refused (expect f)',
       public.trip_agent_can_edit('trip-expired', '11111111-1111-4111-8111-111111111111')
union all select 'edit-share holder can edit (expect t)',
       public.trip_agent_can_edit_with_share('trip-live', '22222222-2222-4222-8222-222222222222', 'edit-token')
union all select 'view token refused (expect f)',
       public.trip_agent_can_edit_with_share('trip-live', '22222222-2222-4222-8222-222222222222', 'view-token')
union all select 'unknown token refused (expect f)',
       public.trip_agent_can_edit_with_share('trip-live', '22222222-2222-4222-8222-222222222222', 'made-up')
union all select 'no token, no membership (expect f)',
       public.trip_agent_can_edit_with_share('trip-live', '22222222-2222-4222-8222-222222222222', null);

-- The defect this migration fixes: the stale status has to survive the call.
insert into public.trip_agent_change_sets(id, trip_id, base_trip_updated_at, summary, operations, status)
values ('33333333-3333-4333-8333-333333333333', 'trip-live', 999, 'Stale set', '[{"id":"op-1"}]'::jsonb, 'pending');

select 'stale call returns status (expect stale)' as case,
       public.apply_trip_agent_change_set(
         '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333',
         array['op-1'], '{"updatedAt":101}'::jsonb, null, null) ->> 'status' as result;
select 'stale status persisted (expect stale)' as case, status as result
  from public.trip_agent_change_sets where id = '33333333-3333-4333-8333-333333333333';

-- A healthy apply still commits the trip, the version and the change-set status.
insert into public.trip_agent_change_sets(id, trip_id, base_trip_updated_at, summary, operations, status)
values ('44444444-4444-4444-8444-444444444444', 'trip-live', 100, 'Good set', '[{"id":"op-1"}]'::jsonb, 'pending');

select 'apply returns status (expect applied)' as case,
       public.apply_trip_agent_change_set(
         '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444',
         array['op-1'], '{"updatedAt":200,"title":"Renamed"}'::jsonb, null, null) ->> 'status' as result;
select 'trip row updated (expect 200)' as case, data ->> 'updatedAt' as result
  from public.trips where id = 'trip-live';
select 'version recorded (expect 1)' as case, count(*)::text as result from public.trip_versions;

-- An editable-share holder may apply; without the token the same user may not.
insert into public.trip_agent_change_sets(id, trip_id, base_trip_updated_at, summary, operations, status)
values ('55555555-5555-4555-8555-555555555555', 'trip-live', 200, 'Share set', '[{"id":"op-1"}]'::jsonb, 'pending');
select 'share holder can apply (expect applied)' as case,
       public.apply_trip_agent_change_set(
         '22222222-2222-4222-8222-222222222222', '55555555-5555-4555-8555-555555555555',
         array['op-1'], '{"updatedAt":300}'::jsonb, null, 'edit-token') ->> 'status' as result;

-- Expect: ERROR TRIP_AGENT_EDIT_ACCESS_REQUIRED
insert into public.trip_agent_change_sets(id, trip_id, base_trip_updated_at, summary, operations, status)
values ('66666666-6666-4666-8666-666666666666', 'trip-live', 300, 'No token', '[{"id":"op-1"}]'::jsonb, 'pending');
select public.apply_trip_agent_change_set(
         '22222222-2222-4222-8222-222222222222', '66666666-6666-4666-8666-666666666666',
         array['op-1'], '{"updatedAt":400}'::jsonb, null, null);
