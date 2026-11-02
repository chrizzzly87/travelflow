-- External trip drafts (issue #597, docs/EXTERNAL_TRIP_DRAFTS.md).
--
-- Outside assistants (ChatGPT, Claude, browser agents through WebMCP) send a
-- finished `travelflow_trip_plan_v3` itinerary. The edge function validates it,
-- builds the trip and stores it here through `create_trip_draft` on the service
-- role. No model runs on our side.
--
-- A draft has no owner: `trips.owner_id` is required and RLS is owner-based, so
-- drafts stay in their own table until someone saves one. Saving goes through
-- the normal `upsert_trip` path, then `claim_trip_draft` records the link.
--
-- RLS is on with no policies: only the service role and the security-definer
-- functions below can read or write these tables.

create table if not exists public.trip_drafts (
  id text primary key check (id ~ '^drf_[A-Za-z0-9]{24}$'),
  title text not null default 'Untitled trip',
  start_date date,
  round_trip boolean not null default false,
  data jsonb not null,
  source_payload jsonb not null default '{}'::jsonb,
  source text not null default 'api' check (source in ('api', 'mcp', 'webmcp', 'paste')),
  client_name text,
  client_model text,
  user_agent text,
  ip_hash text,
  city_count integer not null default 0,
  activity_count integer not null default 0,
  country_codes text[] not null default '{}'::text[],
  status text not null default 'draft' check (status in ('draft', 'claimed', 'expired')),
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  claim_count integer not null default 0,
  first_claimed_at timestamptz,
  first_claimed_by uuid references auth.users on delete set null,
  first_claimed_trip_id text references public.trips(id) on delete set null,
  expires_at timestamptz default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_drafts_created_at_idx on public.trip_drafts (created_at desc);
create index if not exists trip_drafts_ip_hash_idx on public.trip_drafts (ip_hash, created_at desc);
create index if not exists trip_drafts_status_idx on public.trip_drafts (status, created_at desc);
create index if not exists trip_drafts_expires_idx on public.trip_drafts (expires_at) where status = 'draft';

create table if not exists public.trip_draft_claims (
  id uuid primary key default gen_random_uuid(),
  draft_id text not null references public.trip_drafts(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  trip_id text references public.trips(id) on delete set null,
  claimed_at timestamptz not null default now(),
  unique (draft_id, user_id)
);

create index if not exists trip_draft_claims_user_idx on public.trip_draft_claims (user_id, claimed_at desc);

create or replace function public.touch_trip_drafts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trip_drafts_set_updated_at on public.trip_drafts;
create trigger trip_drafts_set_updated_at
  before update on public.trip_drafts
  for each row execute function public.touch_trip_drafts_updated_at();

alter table public.trip_drafts enable row level security;
alter table public.trip_draft_claims enable row level security;

revoke all on public.trip_drafts from anon, authenticated;
revoke all on public.trip_draft_claims from anon, authenticated;
grant all on public.trip_drafts to service_role;
grant all on public.trip_draft_claims to service_role;

comment on table public.trip_drafts is
  'Trips planned by outside assistants (MCP, WebMCP, API, paste). Viewable by link for 30 days; saved into an account through claim_trip_draft. Expired unclaimed drafts are purged.';

-- Insert one draft. Called only by the trip-drafts edge function on the service
-- role, after validation. Returns a status instead of raising so the caller can
-- answer with a precise HTTP status.
create or replace function public.create_trip_draft(
  p_id text,
  p_title text,
  p_start_date date,
  p_round_trip boolean,
  p_data jsonb,
  p_source_payload jsonb,
  p_source text,
  p_client_name text default null,
  p_client_model text default null,
  p_user_agent text default null,
  p_ip_hash text default null,
  p_city_count integer default 0,
  p_activity_count integer default 0,
  p_country_codes text[] default '{}'::text[],
  p_hourly_ip_limit integer default 30,
  p_daily_global_limit integer default 2000
)
returns table(ok boolean, code text, draft_id text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_recent integer;
  v_expires timestamptz;
begin
  -- Lazy purge keeps the table small without a cron job. Bounded so one
  -- request never does unbounded work. Claimed drafts stay (hidden once
  -- expired) so the admin conversion numbers keep their history.
  delete from public.trip_drafts d
   where d.id in (
     select x.id from public.trip_drafts x
      where x.status = 'draft' and x.expires_at is not null and x.expires_at < now()
      order by x.expires_at
      limit 200
   );

  -- Serialise creates per caller so parallel requests cannot all pass the
  -- count before any of them inserts.
  perform pg_advisory_xact_lock(hashtext('trip_drafts:' || coalesce(p_ip_hash, 'unknown')));

  if p_hourly_ip_limit > 0 then
    select count(*) into v_recent
      from public.trip_drafts d
     where d.ip_hash is not distinct from p_ip_hash
       and d.created_at > now() - interval '1 hour';
    if v_recent >= p_hourly_ip_limit then
      return query select false, 'rate_limited_ip'::text, null::text, null::timestamptz;
      return;
    end if;
  end if;

  if p_daily_global_limit > 0 then
    select count(*) into v_recent
      from public.trip_drafts d
     where d.created_at > now() - interval '1 day';
    if v_recent >= p_daily_global_limit then
      return query select false, 'rate_limited_global'::text, null::text, null::timestamptz;
      return;
    end if;
  end if;

  insert into public.trip_drafts (
    id, title, start_date, round_trip, data, source_payload, source,
    client_name, client_model, user_agent, ip_hash,
    city_count, activity_count, country_codes
  ) values (
    p_id,
    coalesce(nullif(left(btrim(p_title), 120), ''), 'Untitled trip'),
    p_start_date,
    coalesce(p_round_trip, false),
    p_data,
    coalesce(p_source_payload, '{}'::jsonb),
    p_source,
    nullif(left(btrim(p_client_name), 80), ''),
    nullif(left(btrim(p_client_model), 80), ''),
    nullif(left(p_user_agent, 300), ''),
    p_ip_hash,
    greatest(coalesce(p_city_count, 0), 0),
    greatest(coalesce(p_activity_count, 0), 0),
    coalesce(p_country_codes, '{}'::text[])
  )
  returning trip_drafts.expires_at into v_expires;

  return query select true, 'created'::text, p_id, v_expires;
end;
$$;

-- Public read by id. The id is the capability, like a share token. A draft
-- link stops working after `expires_at`, claimed or not; saved trips live on.
create or replace function public.get_trip_draft(
  p_draft_id text,
  p_track_view boolean default true
)
returns table(
  id text,
  title text,
  start_date date,
  round_trip boolean,
  data jsonb,
  source text,
  client_name text,
  client_model text,
  status text,
  view_count integer,
  claim_count integer,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_track_view then
    update public.trip_drafts d
       set view_count = d.view_count + 1,
           last_viewed_at = now()
     where d.id = p_draft_id
       and (d.expires_at is null or d.expires_at > now());
  end if;

  return query
  select d.id, d.title, d.start_date, d.round_trip, d.data, d.source,
         d.client_name, d.client_model, d.status, d.view_count, d.claim_count,
         d.expires_at, d.created_at
    from public.trip_drafts d
   where d.id = p_draft_id
     and (d.expires_at is null or d.expires_at > now());
end;
$$;

-- The caller's saved copy of a draft, so saving twice opens the same trip.
create or replace function public.get_my_trip_draft_claim(p_draft_id text)
returns table(trip_id text, claimed_at timestamptz)
language sql
security definer
set search_path = public
set row_security = off
as $$
  select c.trip_id, c.claimed_at
    from public.trip_draft_claims c
    join public.trips t on t.id = c.trip_id and t.owner_id = auth.uid()
   where c.draft_id = p_draft_id
     and c.user_id = auth.uid()
   limit 1;
$$;

-- Record that the caller saved a draft as `p_trip_id`. The client creates the
-- trip first through `upsert_trip`, so limits, expiry and history behave like
-- any other new trip; this only links the two and counts the conversion.
create or replace function public.claim_trip_draft(
  p_draft_id text,
  p_trip_id text
)
returns table(ok boolean, code text, trip_id text)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
  v_existing text;
  v_draft public.trip_drafts%rowtype;
begin
  if v_uid is null then
    return query select false, 'not_authenticated'::text, null::text;
    return;
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return query select false, 'account_required'::text, null::text;
    return;
  end if;

  select * into v_draft from public.trip_drafts d where d.id = p_draft_id;
  if not found or (v_draft.expires_at is not null and v_draft.expires_at <= now()) then
    return query select false, 'draft_not_found'::text, null::text;
    return;
  end if;

  select c.trip_id into v_existing
    from public.trip_draft_claims c
    join public.trips t on t.id = c.trip_id and t.owner_id = v_uid
   where c.draft_id = p_draft_id and c.user_id = v_uid;
  if v_existing is not null then
    return query select true, 'already_claimed'::text, v_existing;
    return;
  end if;

  if not exists (select 1 from public.trips t where t.id = p_trip_id and t.owner_id = v_uid) then
    return query select false, 'trip_not_found'::text, null::text;
    return;
  end if;

  insert into public.trip_draft_claims (draft_id, user_id, trip_id)
  values (p_draft_id, v_uid, p_trip_id)
  on conflict (draft_id, user_id) do update set trip_id = excluded.trip_id, claimed_at = now();

  update public.trip_drafts d
     set status = 'claimed',
         claim_count = d.claim_count + 1,
         first_claimed_at = coalesce(d.first_claimed_at, now()),
         first_claimed_by = coalesce(d.first_claimed_by, v_uid),
         first_claimed_trip_id = coalesce(d.first_claimed_trip_id, p_trip_id)
   where d.id = p_draft_id;

  return query select true, 'claimed'::text, p_trip_id;
end;
$$;

create or replace function public.admin_list_trip_drafts(
  p_limit integer default 200,
  p_offset integer default 0,
  p_status text default null,
  p_search text default null,
  p_since timestamptz default null
)
returns table(
  id text,
  title text,
  start_date date,
  source text,
  client_name text,
  client_model text,
  city_count integer,
  activity_count integer,
  country_codes text[],
  status text,
  view_count integer,
  last_viewed_at timestamptz,
  claim_count integer,
  first_claimed_at timestamptz,
  first_claimed_by uuid,
  first_claimed_by_email text,
  first_claimed_trip_id text,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not public.has_admin_permission('trips.read') then
    raise exception 'Not allowed';
  end if;

  return query
  select d.id, d.title, d.start_date, d.source, d.client_name, d.client_model,
         d.city_count, d.activity_count, d.country_codes,
         case when d.status = 'draft' and d.expires_at is not null and d.expires_at <= now()
              then 'expired' else d.status end as status,
         d.view_count, d.last_viewed_at, d.claim_count, d.first_claimed_at,
         d.first_claimed_by, u.email::text, d.first_claimed_trip_id,
         d.expires_at, d.created_at
    from public.trip_drafts d
    left join auth.users u on u.id = d.first_claimed_by
   where (p_since is null or d.created_at >= p_since)
     and (
       p_status is null
       or (p_status = 'expired' and d.status = 'draft' and d.expires_at <= now())
       or (p_status = 'draft' and d.status = 'draft' and (d.expires_at is null or d.expires_at > now()))
       or (p_status not in ('draft', 'expired') and d.status = p_status)
     )
     and (
       v_search is null
       or d.id ilike '%' || v_search || '%'
       or d.title ilike '%' || v_search || '%'
       or coalesce(d.client_name, '') ilike '%' || v_search || '%'
       or coalesce(d.first_claimed_trip_id, '') ilike '%' || v_search || '%'
     )
   order by d.created_at desc
   limit greatest(1, least(coalesce(p_limit, 200), 500))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

create or replace function public.admin_get_trip_draft_stats(p_since timestamptz default null)
returns table(
  created_count bigint,
  claimed_count bigint,
  claim_total bigint,
  view_total bigint,
  expired_count bigint,
  by_source jsonb,
  by_client jsonb
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.has_admin_permission('trips.read') then
    raise exception 'Not allowed';
  end if;

  return query
  with base as (
    select * from public.trip_drafts d
     where p_since is null or d.created_at >= p_since
  )
  select
    (select count(*) from base),
    (select count(*) from base b where b.claim_count > 0),
    (select coalesce(sum(b.claim_count), 0)::bigint from base b),
    (select coalesce(sum(b.view_count), 0)::bigint from base b),
    (select count(*) from base b where b.status = 'draft' and b.expires_at <= now()),
    coalesce((
      select jsonb_object_agg(s.source, jsonb_build_object('created', s.created, 'claimed', s.claimed))
        from (select b.source, count(*) as created, count(*) filter (where b.claim_count > 0) as claimed
                from base b group by b.source) s
    ), '{}'::jsonb),
    coalesce((
      select jsonb_object_agg(c.client, jsonb_build_object('created', c.created, 'claimed', c.claimed))
        from (select coalesce(lower(b.client_name), 'unknown') as client, count(*) as created,
                     count(*) filter (where b.claim_count > 0) as claimed
                from base b group by 1) c
    ), '{}'::jsonb);
end;
$$;

revoke all on function public.create_trip_draft(text, text, date, boolean, jsonb, jsonb, text, text, text, text, text, integer, integer, text[], integer, integer) from public, anon, authenticated;
revoke all on function public.get_trip_draft(text, boolean) from public, anon, authenticated;
-- Supabase grants EXECUTE to anon by default; these are for signed-in users only.
revoke all on function public.get_my_trip_draft_claim(text) from public, anon;
revoke all on function public.claim_trip_draft(text, text) from public, anon;
revoke all on function public.admin_list_trip_drafts(integer, integer, text, text, timestamptz) from public, anon;
revoke all on function public.admin_get_trip_draft_stats(timestamptz) from public, anon;
grant execute on function public.create_trip_draft(text, text, date, boolean, jsonb, jsonb, text, text, text, text, text, integer, integer, text[], integer, integer) to service_role;
grant execute on function public.get_trip_draft(text, boolean) to service_role;
grant execute on function public.get_my_trip_draft_claim(text) to authenticated;
grant execute on function public.claim_trip_draft(text, text) to authenticated;
grant execute on function public.admin_list_trip_drafts(integer, integer, text, text, timestamptz) to authenticated;
grant execute on function public.admin_get_trip_draft_stats(timestamptz) to authenticated;
