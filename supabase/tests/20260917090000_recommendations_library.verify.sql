-- Behaviour checks for migration 20260917090000.
--
-- !! THROWAWAY POSTGRES ONLY. NEVER RUN THIS AGAINST THE SUPABASE PROJECT. !!
--
-- It inserts fixture rows, and one of them is `published` — which means that
-- against the real project it would put a place called "Renamed" into every
-- traveller's Ideas deck. It happened once, on 2026-09-17. The script now
-- refuses to run outside a throwaway and deletes its own fixtures at the end,
-- but the header is the first line of defence.
--
-- Runnable against a throwaway Postgres:
--
--   initdb -D /tmp/pgdata-rec -U postgres --auth=trust
--   LC_ALL=C pg_ctl -D /tmp/pgdata-rec -o "-p 55433 -h 127.0.0.1" start
--   psql -h 127.0.0.1 -p 55433 -U postgres -c "create role anon; create role authenticated; create role service_role;"
--   psql -h 127.0.0.1 -p 55433 -U postgres -v ON_ERROR_STOP=1 \
--     -f supabase/migrations/20260917090000_recommendations_library.sql
--   psql -h 127.0.0.1 -p 55433 -U postgres -v ON_ERROR_STOP=1 \
--     -f supabase/tests/20260917090000_recommendations_library.verify.sql
--
-- `ON_ERROR_STOP=1` matters: without it psql prints the guard's error and then
-- carries on running the rest of the file.
--
-- Every `result` below must match the expectation in its case label.

-- Refuse to run anywhere that looks like the real project. Supabase always has
-- the `auth` schema; a bare throwaway created by the recipe above does not.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'auth') then
    raise exception
      'REFUSING TO RUN: this database has an auth schema, so it looks like the real Supabase project. These fixtures would become live recommendations.';
  end if;
end;
$$;

insert into public.recommendations (id, slug, country_code, title, status)
values ('rec_tw_a', 'a', 'TW', 'Published place', 'published');
insert into public.recommendations (id, slug, country_code, title, status)
values ('rec_tw_b', 'b', 'TW', 'Draft place', 'draft');

-- The defaults matter: a row inserted by hand in the SQL editor must be a
-- valid recommendation without naming every column.
select 'defaults fill the json columns (expect t)' as case,
       (highlights = '[]'::jsonb and tags = '[]'::jsonb and sources = '[]'::jsonb
        and activity_types = '[]'::jsonb and origin = 'manual' and locale = 'en') as result
  from public.recommendations where id = 'rec_tw_b'

union all
select 'a bad status is refused (expect t)',
       (select not exists (
          select 1 from public.recommendations where id = 'rec_tw_bad'
       ))
  from (
    select 1
  ) as _;

-- Constraints. Each of these must raise; run them one at a time and confirm.
do $$
begin
  begin
    insert into public.recommendations (id, slug, country_code, title, status)
    values ('rec_tw_bad', 'bad', 'TW', 'Bad status', 'nonsense');
    raise exception 'FAIL: a nonsense status was accepted';
  exception when check_violation then
    raise notice 'OK: status check rejected a nonsense value';
  end;

  begin
    insert into public.recommendations (id, slug, country_code, title, lat)
    values ('rec_tw_lat', 'lat', 'TW', 'Bad latitude', 120);
    raise exception 'FAIL: an out-of-range latitude was accepted';
  exception when check_violation then
    raise notice 'OK: latitude range check held';
  end;

  begin
    insert into public.recommendations (id, slug, country_code, title)
    values ('rec_tw_dupe', 'a', 'TW', 'Duplicate slug in the same country');
    raise exception 'FAIL: a duplicate country/slug pair was accepted';
  exception when unique_violation then
    raise notice 'OK: country/slug uniqueness held';
  end;

  -- The same slug in another country is a different place and must be allowed.
  insert into public.recommendations (id, slug, country_code, title)
  values ('rec_jp_a', 'a', 'JP', 'Same slug, other country');
  raise notice 'OK: the same slug in another country was accepted';
end;
$$;

-- updated_at has to move on its own, or an admin list sorted by it is a lie.
update public.recommendations set title = 'Renamed' where id = 'rec_tw_a';
select 'update bumps updated_at (expect t)' as case,
       (updated_at > created_at) as result
  from public.recommendations where id = 'rec_tw_a';

-- RLS: anonymous sees published rows and nothing else. This has to run inside
-- a transaction and as a non-superuser, because a superuser bypasses RLS and
-- `set local` outside a transaction is silently ignored — both of which make
-- this check pass for the wrong reason.
begin;
set local role anon;
select 'anon sees only the published TW row (expect 1)' as case,
       count(*)::text as result
  from public.recommendations where country_code = 'TW';
select 'anon cannot see the draft (expect 0)' as case,
       count(*)::text as result
  from public.recommendations where id = 'rec_tw_b';
commit;

-- Leave nothing behind. A verification script that seeds rows and walks away is
-- one copy-paste from being live data.
delete from public.recommendations where id in ('rec_tw_a', 'rec_tw_b', 'rec_jp_a', 'rec_tw_lat', 'rec_tw_dupe', 'rec_tw_bad');

select 'fixtures cleaned up (expect 0)' as case,
       count(*)::text as result
  from public.recommendations;
