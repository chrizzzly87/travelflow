-- Behaviour checks for migration 20261031120000 (external trip drafts).
--
-- !! THROWAWAY POSTGRES ONLY. NEVER RUN THIS AGAINST THE SUPABASE PROJECT. !!
--
-- It creates its own stand-ins for auth.users, auth.uid(), auth.jwt(),
-- public.trips and public.has_admin_permission(), which would clobber the real
-- ones. The guard below refuses to run where an `auth` schema already exists.
--
--   initdb -D /tmp/pgdata-drafts -U postgres --auth=trust
--   LC_ALL=C pg_ctl -D /tmp/pgdata-drafts -o "-p 55434 -h 127.0.0.1" start
--   psql -h 127.0.0.1 -p 55434 -U postgres -v ON_ERROR_STOP=1 \
--     -f supabase/tests/20261031120000_trip_drafts.verify.sql
--
-- The script loads the migration itself (\ir) after the stubs. Every `result`
-- must match the expectation in its case label.

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'auth') then
    raise exception 'REFUSING TO RUN: this database has an auth schema, so it may be a real Supabase project.';
  end if;
end;
$$;

do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;

create extension if not exists pgcrypto;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select jsonb_build_object('is_anonymous', coalesce(nullif(current_setting('test.anon', true), ''), 'false'))
$$;
create table public.trips (id text primary key, owner_id uuid not null, data jsonb not null default '{}'::jsonb);
create function public.has_admin_permission(p_permission text, p_user_id uuid default null)
returns boolean language sql stable as $$
  select coalesce(current_setting('test.admin', true), '') = 'on'
$$;

\ir ../migrations/20261031120000_trip_drafts.sql

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');
insert into public.trips (id, owner_id) values
  ('trip-a', '00000000-0000-0000-0000-00000000000a'),
  ('trip-b', '00000000-0000-0000-0000-00000000000b');

select 'create returns created (expect t)' as case,
       (select ok and code = 'created' from public.create_trip_draft(
          'drf_AAAAAAAAAAAAAAAAAAAAAAAA', 'Japan', '2027-04-01', false,
          '{"id":"x"}'::jsonb, '{}'::jsonb, 'mcp', 'chatgpt', 'gpt-5', 'ua', 'ip1', 3, 9, array['JP'])) as result
union all
select 'bad id is refused by the check (expect t)',
       (select count(*) = 0 from public.trip_drafts where id = 'drf_short');

-- Hourly per-IP cap of 1 refuses the second insert from the same IP.
select 'per-IP cap (expect t)' as case,
       (select not ok and code = 'rate_limited_ip' from public.create_trip_draft(
          'drf_BBBBBBBBBBBBBBBBBBBBBBBB', 'Japan 2', null, false, '{}'::jsonb, '{}'::jsonb, 'api',
          null, null, null, 'ip1', 0, 0, '{}', 1, 2000)) as result
union all
select 'global daily cap (expect t)',
       (select not ok and code = 'rate_limited_global' from public.create_trip_draft(
          'drf_CCCCCCCCCCCCCCCCCCCCCCCC', 'Japan 3', null, false, '{}'::jsonb, '{}'::jsonb, 'api',
          null, null, null, 'ip2', 0, 0, '{}', 30, 1));

select 'get bumps the view count (expect 1)' as case,
       (select view_count::text from public.get_trip_draft('drf_AAAAAAAAAAAAAAAAAAAAAAAA', true)) as result
union all
select 'get without tracking keeps it (expect 1)',
       (select view_count::text from public.get_trip_draft('drf_AAAAAAAAAAAAAAAAAAAAAAAA', false));

-- Expired, unclaimed drafts read as missing.
insert into public.trip_drafts (id, data, expires_at) values ('drf_EEEEEEEEEEEEEEEEEEEEEEEE', '{}', now() - interval '1 day');
select 'expired draft is hidden (expect 0)' as case,
       (select count(*)::text from public.get_trip_draft('drf_EEEEEEEEEEEEEEEEEEEEEEEE', true)) as result;

-- Claims.
set test.uid = '';
select 'claim without a user (expect not_authenticated)' as case,
       (select code from public.claim_trip_draft('drf_AAAAAAAAAAAAAAAAAAAAAAAA', 'trip-a')) as result;

set test.uid = '00000000-0000-0000-0000-00000000000a';
set test.anon = 'true';
select 'claim as a guest (expect account_required)' as case,
       (select code from public.claim_trip_draft('drf_AAAAAAAAAAAAAAAAAAAAAAAA', 'trip-a')) as result;

set test.anon = 'false';
select 'claim into someone else''s trip (expect trip_not_found)' as case,
       (select code from public.claim_trip_draft('drf_AAAAAAAAAAAAAAAAAAAAAAAA', 'trip-b')) as result
union all
select 'claim an expired draft (expect draft_not_found)',
       (select code from public.claim_trip_draft('drf_EEEEEEEEEEEEEEEEEEEEEEEE', 'trip-a'));

select 'first claim (expect claimed)' as case,
       (select code from public.claim_trip_draft('drf_AAAAAAAAAAAAAAAAAAAAAAAA', 'trip-a')) as result;
select 'second claim by the same user returns the trip (expect already_claimed/trip-a)' as case,
       (select code || '/' || trip_id from public.claim_trip_draft('drf_AAAAAAAAAAAAAAAAAAAAAAAA', 'trip-a')) as result
union all
select 'my claim lookup (expect trip-a)',
       (select trip_id from public.get_my_trip_draft_claim('drf_AAAAAAAAAAAAAAAAAAAAAAAA'))
union all
select 'draft is claimed and keeps its expiry (expect claimed/1/true)',
       (select status || '/' || claim_count || '/' || (expires_at is not null)::text from public.trip_drafts where id = 'drf_AAAAAAAAAAAAAAAAAAAAAAAA');

set test.uid = '00000000-0000-0000-0000-00000000000b';
select 'another user can save the same draft (expect claimed)' as case,
       (select code from public.claim_trip_draft('drf_AAAAAAAAAAAAAAAAAAAAAAAA', 'trip-b')) as result;
select 'claim count and first claimer kept (expect 2/trip-a)' as case,
       (select claim_count || '/' || first_claimed_trip_id from public.trip_drafts where id = 'drf_AAAAAAAAAAAAAAAAAAAAAAAA') as result;

-- A claimed draft link still expires; the saved trip is unaffected.
update public.trip_drafts set expires_at = now() - interval '1 minute' where id = 'drf_AAAAAAAAAAAAAAAAAAAAAAAA';
select 'expired claimed draft is hidden (expect 0)' as case,
       (select count(*)::text from public.get_trip_draft('drf_AAAAAAAAAAAAAAAAAAAAAAAA', false)) as result;
select 'expired claimed draft is not purged (expect 1)' as case,
       (select count(*)::text from public.trip_drafts where id = 'drf_AAAAAAAAAAAAAAAAAAAAAAAA') as result;
update public.trip_drafts set expires_at = now() + interval '30 days' where id = 'drf_AAAAAAAAAAAAAAAAAAAAAAAA';

-- Admin.
set test.admin = 'off';
do $$
begin
  perform * from public.admin_list_trip_drafts();
  raise exception 'admin list should have refused';
exception when others then
  if sqlerrm <> 'Not allowed' then raise; end if;
end;
$$;

set test.admin = 'on';
select 'admin list sees the expired row as expired (expect expired)' as case,
       (select status from public.admin_list_trip_drafts() where id = 'drf_EEEEEEEEEEEEEEEEEEEEEEEE') as result
union all
select 'admin list filter by claimed (expect 1)',
       (select count(*)::text from public.admin_list_trip_drafts(200, 0, 'claimed'))
union all
select 'admin list shows the first claimer email (expect a@example.com)',
       (select first_claimed_by_email from public.admin_list_trip_drafts() where id = 'drf_AAAAAAAAAAAAAAAAAAAAAAAA')
union all
select 'stats (expect 2/1/2/1)',
       (select created_count || '/' || claimed_count || '/' || claim_total || '/' || expired_count from public.admin_get_trip_draft_stats())
union all
select 'stats by client (expect 1)',
       (select (by_client -> 'chatgpt' ->> 'claimed') from public.admin_get_trip_draft_stats());

-- The lazy purge removes expired unclaimed drafts on the next create.
select 'purge on create (expect true)' as case,
       (select ok::text from public.create_trip_draft(
          'drf_DDDDDDDDDDDDDDDDDDDDDDDD', 'Later', null, false, '{}'::jsonb, '{}'::jsonb, 'paste',
          null, null, null, 'ip9')) as result;
select 'expired row is gone (expect 0)' as case,
       (select count(*)::text from public.trip_drafts where id = 'drf_EEEEEEEEEEEEEEEEEEEEEEEE') as result;

-- Read roles cannot reach the tables or the service-role functions.
select 'anon cannot select drafts (expect f)' as case,
       has_table_privilege('anon', 'public.trip_drafts', 'select')::text as result
union all
select 'authenticated cannot call create (expect f)',
       has_function_privilege('authenticated', 'public.create_trip_draft(text, text, date, boolean, jsonb, jsonb, text, text, text, text, text, integer, integer, text[], integer, integer)', 'execute')::text
union all
select 'anon cannot call claim (expect false)',
       has_function_privilege('anon', 'public.claim_trip_draft(text, text)', 'execute')::text
union all
select 'anon cannot call the admin list (expect false)',
       has_function_privilege('anon', 'public.admin_list_trip_drafts(integer, integer, text, text, timestamptz)', 'execute')::text
union all
select 'authenticated can call claim (expect true)',
       has_function_privilege('authenticated', 'public.claim_trip_draft(text, text)', 'execute')::text
union all
select 'anon cannot call get (expect f)',
       has_function_privilege('anon', 'public.get_trip_draft(text, boolean)', 'execute')::text;

-- Null IP hashes share one bucket instead of skipping the per-IP cap.
select 'first draft without an IP (expect created)' as case,
       (select code from public.create_trip_draft(
          'drf_NNNNNNNNNNNNNNNNNNNNNNNN', 'No IP', null, false, '{}'::jsonb, '{}'::jsonb, 'api',
          null, null, null, null, 0, 0, '{}', 1, 2000)) as result;
select 'second draft without an IP is capped (expect rate_limited_ip)' as case,
       (select code from public.create_trip_draft(
          'drf_MMMMMMMMMMMMMMMMMMMMMMMM', 'No IP 2', null, false, '{}'::jsonb, '{}'::jsonb, 'api',
          null, null, null, null, 0, 0, '{}', 1, 2000)) as result;
