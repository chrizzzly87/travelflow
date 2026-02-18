-- Supabase schema for TravelFlow
-- Run this in the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- Base tables
create table if not exists public.trips (
  id text primary key,
  owner_id uuid not null references auth.users on delete cascade default auth.uid(),
  title text not null default 'Untitled trip',
  start_date date,
  data jsonb not null,
  view_settings jsonb,
  is_favorite boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived', 'expired')),
  trip_expires_at timestamptz,
  archived_at timestamptz,
  source_kind text,
  source_template_id text,
  sharing_enabled boolean not null default true,
  forked_from_trip_id text,
  forked_from_share_token text,
  forked_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_versions (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references public.trips(id) on delete cascade,
  version_number integer,
  data jsonb not null,
  view_settings jsonb,
  label text,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.trip_shares (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references public.trips(id) on delete cascade,
  token text not null unique,
  mode text not null check (mode in ('view', 'edit')),
  allow_copy boolean not null default true,
  created_by uuid references auth.users,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

create table if not exists public.trip_collaborators (
  trip_id text not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  plan_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users on delete cascade,
  language text default 'en',
  map_style text,
  route_mode text,
  layout_mode text,
  timeline_view text,
  show_city_names boolean,
  zoom_level numeric,
  sidebar_width numeric,
  timeline_height numeric,
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  max_trips integer not null default 5,
  price_cents integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  plan_id uuid references public.plans(id),
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_benchmark_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade default auth.uid(),
  share_token text not null unique,
  name text,
  flow text not null default 'classic' check (flow in ('classic', 'wizard', 'surprise')),
  scenario jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.ai_benchmark_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_benchmark_sessions(id) on delete cascade,
  provider text not null,
  model text not null,
  label text,
  run_index integer not null default 1,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  latency_ms integer,
  schema_valid boolean,
  validation_checks jsonb,
  validation_errors jsonb,
  usage jsonb,
  cost_usd numeric(12,6),
  request_payload jsonb,
  raw_output jsonb,
  normalized_trip jsonb,
  trip_id text references public.trips(id) on delete set null,
  trip_ai_meta jsonb,
  error_message text,
  satisfaction_rating text check (satisfaction_rating in ('good', 'medium', 'bad')),
  satisfaction_updated_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

-- Forward-compatible schema upgrades
alter table public.trips add column if not exists sharing_enabled boolean not null default true;
alter table public.trips add column if not exists status text not null default 'active';
alter table public.trips add column if not exists trip_expires_at timestamptz;
alter table public.trips add column if not exists archived_at timestamptz;
alter table public.trips add column if not exists source_kind text;
alter table public.trips add column if not exists source_template_id text;
alter table public.ai_benchmark_runs add column if not exists satisfaction_rating text;
alter table public.ai_benchmark_runs add column if not exists satisfaction_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trips_status_check'
      and conrelid = 'public.trips'::regclass
  ) then
    alter table public.trips
      add constraint trips_status_check
      check (status in ('active', 'archived', 'expired'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_benchmark_runs_satisfaction_rating_check'
      and conrelid = 'public.ai_benchmark_runs'::regclass
  ) then
    alter table public.ai_benchmark_runs
      add constraint ai_benchmark_runs_satisfaction_rating_check
      check (satisfaction_rating in ('good', 'medium', 'bad'));
  end if;
end;
$$;

-- Indexes
create index if not exists trips_owner_id_idx on public.trips(owner_id);
create index if not exists trips_updated_at_idx on public.trips(updated_at desc);
create index if not exists trips_forked_from_idx on public.trips(forked_from_trip_id);
create index if not exists trips_status_idx on public.trips(status);
create index if not exists trips_owner_status_idx on public.trips(owner_id, status);
create index if not exists trips_trip_expires_at_idx on public.trips(trip_expires_at);
create index if not exists trip_versions_trip_id_idx on public.trip_versions(trip_id);
create index if not exists trip_versions_created_at_idx on public.trip_versions(created_at desc);
create index if not exists trip_shares_trip_id_idx on public.trip_shares(trip_id);
create index if not exists trip_collaborators_user_id_idx on public.trip_collaborators(user_id);
create index if not exists ai_benchmark_sessions_owner_created_idx on public.ai_benchmark_sessions(owner_id, created_at desc);
create index if not exists ai_benchmark_runs_session_created_idx on public.ai_benchmark_runs(session_id, created_at asc);
create index if not exists ai_benchmark_runs_session_status_idx on public.ai_benchmark_runs(session_id, status);
create index if not exists ai_benchmark_runs_trip_id_idx on public.ai_benchmark_runs(trip_id);

-- updated_at helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_trips_updated_at on public.trips;
create trigger set_trips_updated_at
before update on public.trips
for each row execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Ensure owner_id/created_by are set from auth context
create or replace function public.set_trip_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_trip_owner on public.trips;
create trigger set_trip_owner
before insert on public.trips
for each row execute function public.set_trip_owner();

create or replace function public.set_trip_version_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_trip_version_creator on public.trip_versions;
create trigger set_trip_version_creator
before insert on public.trip_versions
for each row execute function public.set_trip_version_creator();

-- Anonymous/guest limits (trip-based)
create or replace function public.get_trip_limit_for_user(p_user_id uuid)
returns integer
language sql
stable
as $$
  select 3;
$$;

create or replace function public.can_create_trip()
returns table(allow_create boolean, active_trip_count integer, max_trip_count integer)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_owner uuid;
  v_count integer;
  v_limit integer;
begin
  v_owner := auth.uid();
  if v_owner is null then
    raise exception 'Not authenticated';
  end if;

  v_limit := public.get_trip_limit_for_user(v_owner);

  select count(*)
    into v_count
    from public.trips t
   where t.owner_id = v_owner
     and coalesce(t.status, 'active') <> 'archived';

  return query
  select (v_count < v_limit), v_count, v_limit;
end;
$$;

-- RPC: Upsert trip with ownership enforcement
create or replace function public.upsert_trip(
  p_id text,
  p_data jsonb,
  p_view jsonb,
  p_title text,
  p_start_date date,
  p_is_favorite boolean,
  p_forked_from_trip_id text,
  p_forked_from_share_token text,
  p_status text default 'active',
  p_trip_expires_at timestamptz default null,
  p_source_kind text default null,
  p_source_template_id text default null
)
returns table(trip_id text)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_owner uuid;
  v_limit integer;
  v_count integer;
  v_status text;
  v_trip_expires_at timestamptz;
begin
  v_owner := auth.uid();
  if v_owner is null then
    raise exception 'Not authenticated';
  end if;

  v_status := case
    when p_status in ('active', 'archived', 'expired') then p_status
    else 'active'
  end;

  if exists (select 1 from public.trips t where t.id = p_id) then
    if not exists (select 1 from public.trips t where t.id = p_id and t.owner_id = v_owner) then
      raise exception 'Not allowed';
    end if;

    update public.trips
       set data = p_data,
           view_settings = p_view,
           title = coalesce(p_title, title),
           start_date = coalesce(p_start_date, start_date),
           is_favorite = coalesce(p_is_favorite, is_favorite),
           forked_from_trip_id = coalesce(p_forked_from_trip_id, forked_from_trip_id),
           forked_from_share_token = coalesce(p_forked_from_share_token, forked_from_share_token),
           status = coalesce(v_status, status),
           trip_expires_at = coalesce(p_trip_expires_at, trip_expires_at),
           source_kind = coalesce(p_source_kind, source_kind),
           source_template_id = coalesce(p_source_template_id, source_template_id),
           updated_at = now()
     where id = p_id;
  else
    v_limit := public.get_trip_limit_for_user(v_owner);
    select count(*)
      into v_count
      from public.trips t
     where t.owner_id = v_owner
       and coalesce(t.status, 'active') <> 'archived';
    if v_count >= v_limit then
      raise exception 'Trip limit reached';
    end if;

    v_trip_expires_at := coalesce(p_trip_expires_at, now() + interval '7 days');

    insert into public.trips (
      id,
      owner_id,
      title,
      start_date,
      data,
      view_settings,
      is_favorite,
      status,
      trip_expires_at,
      source_kind,
      source_template_id,
      forked_from_trip_id,
      forked_from_share_token
    )
    values (
      p_id,
      v_owner,
      coalesce(p_title, 'Untitled trip'),
      p_start_date,
      p_data,
      p_view,
      coalesce(p_is_favorite, false),
      v_status,
      v_trip_expires_at,
      p_source_kind,
      p_source_template_id,
      p_forked_from_trip_id,
      p_forked_from_share_token
    );
  end if;

  return query select p_id as trip_id;
end;
$$;

-- RPC: Add trip version with ownership enforcement
create or replace function public.add_trip_version(
  p_trip_id text,
  p_data jsonb,
  p_view jsonb,
  p_label text
)
returns table(version_id uuid)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_owner uuid;
  v_version_id uuid;
begin
  v_owner := auth.uid();
  if v_owner is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.trips t where t.id = p_trip_id and t.owner_id = v_owner) then
    raise exception 'Not allowed';
  end if;

  insert into public.trip_versions (trip_id, data, view_settings, label, created_by)
  values (p_trip_id, p_data, p_view, p_label, v_owner)
  returning public.trip_versions.id into v_version_id;

  return query select v_version_id as version_id;
end;
$$;

-- Helper for owner checks without RLS recursion
create or replace function public.is_trip_owner(p_trip_id text, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.owner_id = p_user_id
  );
$$;

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists set_ai_benchmark_sessions_updated_at on public.ai_benchmark_sessions;
create trigger set_ai_benchmark_sessions_updated_at
before update on public.ai_benchmark_sessions
for each row execute function public.set_updated_at();

-- Trip version numbers
create or replace function public.set_trip_version_number()
returns trigger
language plpgsql
as $$
begin
  if new.version_number is null then
    select coalesce(max(version_number), 0) + 1
      into new.version_number
      from public.trip_versions
     where trip_id = new.trip_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trip_versions_number on public.trip_versions;
create trigger trip_versions_number
before insert on public.trip_versions
for each row execute function public.set_trip_version_number();

-- RLS
alter table public.trips enable row level security;
alter table public.trip_versions enable row level security;
alter table public.trip_shares enable row level security;
alter table public.trip_collaborators enable row level security;
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.ai_benchmark_sessions enable row level security;
alter table public.ai_benchmark_runs enable row level security;

-- Trips policies
drop policy if exists "Trips are readable by owner or collaborators" on public.trips;
drop policy if exists "Trips insert by owner" on public.trips;
drop policy if exists "Trips update by owner or editor" on public.trips;
drop policy if exists "Trips delete by owner" on public.trips;

create policy "Trips are readable by owner or collaborators"
on public.trips for select
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.trip_collaborators tc
    where tc.trip_id = trips.id and tc.user_id = auth.uid()
  )
);

create policy "Trips insert by owner"
on public.trips for insert
with check (auth.uid() is not null);

create policy "Trips update by owner or editor"
on public.trips for update
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.trip_collaborators tc
    where tc.trip_id = trips.id and tc.user_id = auth.uid() and tc.role = 'editor'
  )
);

create policy "Trips delete by owner"
on public.trips for delete
using (owner_id = auth.uid());

-- Trip versions policies
drop policy if exists "Trip versions readable by owner or collaborators" on public.trip_versions;
drop policy if exists "Trip versions insert by owner or editor" on public.trip_versions;

create policy "Trip versions readable by owner or collaborators"
on public.trip_versions for select
using (
  exists (
    select 1 from public.trips t
    where t.id = trip_versions.trip_id
      and (
        t.owner_id = auth.uid()
        or exists (
          select 1 from public.trip_collaborators tc
          where tc.trip_id = t.id and tc.user_id = auth.uid()
        )
      )
  )
);

create policy "Trip versions insert by owner or editor"
on public.trip_versions for insert
with check (
  exists (
    select 1 from public.trips t
    where t.id = trip_versions.trip_id
      and (
        t.owner_id = auth.uid()
        or exists (
          select 1 from public.trip_collaborators tc
          where tc.trip_id = t.id and tc.user_id = auth.uid() and tc.role = 'editor'
        )
      )
  )
);

-- Trip shares policies (owner only)
drop policy if exists "Trip shares owner read" on public.trip_shares;
drop policy if exists "Trip shares owner insert" on public.trip_shares;
drop policy if exists "Trip shares owner update" on public.trip_shares;
drop policy if exists "Trip shares owner delete" on public.trip_shares;
create policy "Trip shares owner read"
on public.trip_shares for select
using (public.is_trip_owner(trip_shares.trip_id, auth.uid()));

create policy "Trip shares owner insert"
on public.trip_shares for insert
with check (public.is_trip_owner(trip_shares.trip_id, auth.uid()));

create policy "Trip shares owner update"
on public.trip_shares for update
using (public.is_trip_owner(trip_shares.trip_id, auth.uid()));

create policy "Trip shares owner delete"
on public.trip_shares for delete
using (public.is_trip_owner(trip_shares.trip_id, auth.uid()));

-- Trip collaborators policies (owner manages, collaborators can read themselves)
drop policy if exists "Trip collaborators owner manage" on public.trip_collaborators;
drop policy if exists "Trip collaborators self read" on public.trip_collaborators;
create policy "Trip collaborators owner manage"
on public.trip_collaborators for all
using (public.is_trip_owner(trip_collaborators.trip_id, auth.uid()))
with check (public.is_trip_owner(trip_collaborators.trip_id, auth.uid()));

create policy "Trip collaborators self read"
on public.trip_collaborators for select
using (user_id = auth.uid());

-- Profiles policies
drop policy if exists "Profiles are user-owned" on public.profiles;
create policy "Profiles are user-owned"
on public.profiles for all
using (id = auth.uid())
with check (id = auth.uid());

-- User settings policies
drop policy if exists "User settings are user-owned" on public.user_settings;
create policy "User settings are user-owned"
on public.user_settings for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Plans are readable by anyone
drop policy if exists "Plans are readable" on public.plans;
create policy "Plans are readable"
on public.plans for select
using (true);

-- Subscriptions policies
drop policy if exists "Subscriptions are user-owned" on public.subscriptions;
create policy "Subscriptions are user-owned"
on public.subscriptions for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- AI benchmark session policies
drop policy if exists "AI benchmark sessions owner read" on public.ai_benchmark_sessions;
drop policy if exists "AI benchmark sessions owner insert" on public.ai_benchmark_sessions;
drop policy if exists "AI benchmark sessions owner update" on public.ai_benchmark_sessions;
drop policy if exists "AI benchmark sessions owner delete" on public.ai_benchmark_sessions;

create policy "AI benchmark sessions owner read"
on public.ai_benchmark_sessions for select
using (owner_id = auth.uid());

create policy "AI benchmark sessions owner insert"
on public.ai_benchmark_sessions for insert
with check (owner_id = auth.uid());

create policy "AI benchmark sessions owner update"
on public.ai_benchmark_sessions for update
using (owner_id = auth.uid());

create policy "AI benchmark sessions owner delete"
on public.ai_benchmark_sessions for delete
using (owner_id = auth.uid());

-- AI benchmark run policies
drop policy if exists "AI benchmark runs owner read" on public.ai_benchmark_runs;
drop policy if exists "AI benchmark runs owner insert" on public.ai_benchmark_runs;
drop policy if exists "AI benchmark runs owner update" on public.ai_benchmark_runs;
drop policy if exists "AI benchmark runs owner delete" on public.ai_benchmark_runs;

create policy "AI benchmark runs owner read"
on public.ai_benchmark_runs for select
using (
  exists (
    select 1
    from public.ai_benchmark_sessions s
    where s.id = ai_benchmark_runs.session_id
      and s.owner_id = auth.uid()
  )
);

create policy "AI benchmark runs owner insert"
on public.ai_benchmark_runs for insert
with check (
  exists (
    select 1
    from public.ai_benchmark_sessions s
    where s.id = ai_benchmark_runs.session_id
      and s.owner_id = auth.uid()
  )
);

create policy "AI benchmark runs owner update"
on public.ai_benchmark_runs for update
using (
  exists (
    select 1
    from public.ai_benchmark_sessions s
    where s.id = ai_benchmark_runs.session_id
      and s.owner_id = auth.uid()
  )
);

create policy "AI benchmark runs owner delete"
on public.ai_benchmark_runs for delete
using (
  exists (
    select 1
    from public.ai_benchmark_sessions s
    where s.id = ai_benchmark_runs.session_id
      and s.owner_id = auth.uid()
  )
);

-- Share RPC helpers
create or replace function public.create_share_token(
  p_trip_id text,
  p_mode text default 'view',
  p_allow_copy boolean default true
)
returns table(token text, mode text, share_id uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
  v_existing_token text;
  v_existing_share_id uuid;
begin
  if p_mode not in ('view', 'edit') then
    raise exception 'Invalid share mode';
  end if;

  if exists (
    select 1 from public.trips t
    where t.id = p_trip_id
      and t.owner_id = auth.uid()
      and coalesce(t.sharing_enabled, true) = false
  ) then
    raise exception 'Sharing is disabled for this trip';
  end if;

  if not exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.owner_id = auth.uid()
  ) then
    raise exception 'Not allowed';
  end if;

  select s.token, s.id
    into v_existing_token, v_existing_share_id
    from public.trip_shares s
   where s.trip_id = p_trip_id
     and s.mode = p_mode
     and s.revoked_at is null
     and (s.expires_at is null or s.expires_at > now())
   order by s.created_at desc
   limit 1;

  if v_existing_token is not null then
    return query select v_existing_token, p_mode, v_existing_share_id;
    return;
  end if;

  v_token := encode(gen_random_bytes(9), 'hex');

  insert into public.trip_shares (trip_id, token, mode, allow_copy, created_by)
  values (p_trip_id, v_token, p_mode, p_allow_copy, auth.uid())
  returning id into share_id;

  return query select v_token, p_mode, share_id;
end;
$$;

drop function if exists public.get_shared_trip(text);
create or replace function public.get_shared_trip(p_token text)
returns table(
  trip_id text,
  data jsonb,
  view_settings jsonb,
  mode text,
  allow_copy boolean,
  latest_version_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    t.id,
    t.data,
    t.view_settings,
    s.mode,
    s.allow_copy,
    (
      select tv.id
      from public.trip_versions tv
      where tv.trip_id = t.id
      order by tv.created_at desc
      limit 1
    ) as latest_version_id
    from public.trip_shares s
    join public.trips t on t.id = s.trip_id
   where s.token = p_token
     and s.revoked_at is null
     and (s.expires_at is null or s.expires_at > now());
end;
$$;

drop function if exists public.get_shared_trip_version(text, uuid);
create or replace function public.get_shared_trip_version(
  p_token text,
  p_version_id uuid
)
returns table(
  trip_id text,
  data jsonb,
  view_settings jsonb,
  mode text,
  allow_copy boolean,
  version_id uuid,
  latest_version_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id text;
  v_mode text;
  v_allow_copy boolean;
  v_latest_version_id uuid;
begin
  select
    s.trip_id,
    s.mode,
    s.allow_copy,
    (
      select tv.id
      from public.trip_versions tv
      where tv.trip_id = s.trip_id
      order by tv.created_at desc
      limit 1
    )
    into v_trip_id, v_mode, v_allow_copy, v_latest_version_id
    from public.trip_shares s
   where s.token = p_token
     and s.revoked_at is null
     and (s.expires_at is null or s.expires_at > now());

  if v_trip_id is null then
    raise exception 'Invalid or expired share token';
  end if;

  return query
  select
    v.trip_id,
    v.data,
    v.view_settings,
    v_mode,
    v_allow_copy,
    v.id,
    v_latest_version_id
  from public.trip_versions v
  where v.id = p_version_id
    and v.trip_id = v_trip_id;

  if not found then
    raise exception 'Version not found for share token';
  end if;
end;
$$;

create or replace function public.update_shared_trip(
  p_token text,
  p_data jsonb,
  p_view jsonb,
  p_label text
)
returns table(version_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id text;
  v_mode text;
  v_start_date date;
  v_version_id uuid;
begin
  select s.trip_id, s.mode
    into v_trip_id, v_mode
    from public.trip_shares s
   where s.token = p_token
     and s.revoked_at is null
     and (s.expires_at is null or s.expires_at > now());

  if v_trip_id is null then
    raise exception 'Invalid or expired share token';
  end if;

  if v_mode <> 'edit' then
    raise exception 'Share link is view-only';
  end if;

  if p_data ? 'startDate' then
    v_start_date := left(p_data->>'startDate', 10)::date;
  end if;

  update public.trips
     set data = p_data,
         view_settings = p_view,
         title = coalesce(p_data->>'title', title),
         start_date = coalesce(v_start_date, start_date),
         updated_at = now()
   where id = v_trip_id;

  insert into public.trip_versions (trip_id, data, view_settings, label, created_by)
  values (v_trip_id, p_data, p_view, coalesce(p_label, 'Shared edit'), auth.uid())
  returning id into v_version_id;

  return query select v_version_id;
end;
$$;

-- Allow anon/auth to use share RPCs
grant usage on schema public to anon, authenticated;
grant execute on function public.create_share_token(text, text, boolean) to anon, authenticated;
grant execute on function public.get_shared_trip(text) to anon, authenticated;
grant execute on function public.get_shared_trip_version(text, uuid) to anon, authenticated;
grant execute on function public.update_shared_trip(text, jsonb, jsonb, text) to anon, authenticated;
grant execute on function public.can_create_trip() to anon, authenticated;
grant execute on function public.upsert_trip(text, jsonb, jsonb, text, date, boolean, text, text, text, timestamptz, text, text) to anon, authenticated;
grant execute on function public.add_trip_version(text, jsonb, jsonb, text) to anon, authenticated;

-- =============================================================================
-- Auth + roles + tier entitlements + queued generation + auth logs extensions
-- =============================================================================

alter table public.profiles add column if not exists system_role text not null default 'user';
alter table public.profiles add column if not exists tier_key text not null default 'tier_free';
alter table public.profiles add column if not exists entitlements_override jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists role_updated_at timestamptz;
alter table public.profiles add column if not exists role_updated_by uuid references auth.users;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_system_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_system_role_check
      check (system_role in ('admin', 'user'));
  end if;
end;
$$;

alter table public.plans add column if not exists key text;
alter table public.plans add column if not exists entitlements jsonb not null default '{}'::jsonb;
alter table public.plans add column if not exists sort_order integer not null default 0;

create unique index if not exists plans_key_uidx on public.plans(key);
create index if not exists plans_sort_order_idx on public.plans(sort_order);
create index if not exists profiles_tier_key_idx on public.profiles(tier_key);
create index if not exists profiles_system_role_idx on public.profiles(system_role);
create index if not exists profiles_role_updated_at_idx on public.profiles(role_updated_at desc);

create table if not exists public.admin_allowlist (
  email text primary key,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.auth_flow_logs (
  id uuid primary key default gen_random_uuid(),
  flow_id text not null,
  attempt_id text not null,
  step text not null,
  result text not null check (result in ('start', 'success', 'error')),
  provider text,
  user_id uuid references auth.users on delete set null,
  email_hash text,
  ip_hash text,
  ua_hash text,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.trip_generation_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by_anon_id uuid references auth.users on delete set null,
  owner_user_id uuid references auth.users on delete set null,
  flow text not null check (flow in ('classic', 'wizard', 'surprise')),
  payload jsonb not null,
  status text not null default 'pending_auth'
    check (status in ('pending_auth', 'queued', 'running', 'completed', 'failed', 'expired', 'cancelled')),
  result_trip_id text references public.trips(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  claimed_at timestamptz,
  completed_at timestamptz
);

create index if not exists auth_flow_logs_created_at_idx on public.auth_flow_logs(created_at desc);
create index if not exists auth_flow_logs_flow_attempt_idx on public.auth_flow_logs(flow_id, attempt_id);
create index if not exists trip_generation_requests_status_idx on public.trip_generation_requests(status);
create index if not exists trip_generation_requests_expires_idx on public.trip_generation_requests(expires_at);
create index if not exists trip_generation_requests_owner_idx on public.trip_generation_requests(owner_user_id, created_at desc);
create index if not exists trip_generation_requests_anon_idx on public.trip_generation_requests(requested_by_anon_id, created_at desc);

drop trigger if exists set_trip_generation_requests_updated_at on public.trip_generation_requests;
create trigger set_trip_generation_requests_updated_at
before update on public.trip_generation_requests
for each row execute function public.set_updated_at();

insert into public.plans (key, name, max_trips, price_cents, entitlements, sort_order, is_active)
values
  (
    'tier_free',
    'Backpacker',
    5,
    0,
    '{"maxActiveTrips":5,"maxTotalTrips":50,"tripExpirationDays":14,"canShare":true,"canCreateEditableShares":false,"canViewProTrips":true,"canCreateProTrips":false}'::jsonb,
    10,
    true
  ),
  (
    'tier_mid',
    'Explorer',
    30,
    900,
    '{"maxActiveTrips":30,"maxTotalTrips":500,"tripExpirationDays":90,"canShare":true,"canCreateEditableShares":true,"canViewProTrips":true,"canCreateProTrips":true}'::jsonb,
    20,
    true
  ),
  (
    'tier_premium',
    'Globetrotter',
    2147483647,
    1900,
    '{"maxActiveTrips":null,"maxTotalTrips":null,"tripExpirationDays":null,"canShare":true,"canCreateEditableShares":true,"canViewProTrips":true,"canCreateProTrips":true}'::jsonb,
    30,
    true
  )
on conflict (key) do update
set
  name = excluded.name,
  max_trips = excluded.max_trips,
  price_cents = excluded.price_cents,
  entitlements = excluded.entitlements,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

create or replace function public.resolve_default_entitlements(p_tier_key text)
returns jsonb
language sql
stable
as $$
  select case p_tier_key
    when 'tier_mid' then '{"maxActiveTrips":30,"maxTotalTrips":500,"tripExpirationDays":90,"canShare":true,"canCreateEditableShares":true,"canViewProTrips":true,"canCreateProTrips":true}'::jsonb
    when 'tier_premium' then '{"maxActiveTrips":null,"maxTotalTrips":null,"tripExpirationDays":null,"canShare":true,"canCreateEditableShares":true,"canViewProTrips":true,"canCreateProTrips":true}'::jsonb
    else '{"maxActiveTrips":5,"maxTotalTrips":50,"tripExpirationDays":14,"canShare":true,"canCreateEditableShares":false,"canViewProTrips":true,"canCreateProTrips":false}'::jsonb
  end;
$$;

create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.system_role = 'admin'
  );
$$;

create or replace function public.get_effective_entitlements(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tier_key text;
  v_override jsonb;
  v_plan_entitlements jsonb;
begin
  select p.tier_key, p.entitlements_override
    into v_tier_key, v_override
    from public.profiles p
   where p.id = p_user_id;

  v_tier_key := coalesce(v_tier_key, 'tier_free');
  v_override := coalesce(v_override, '{}'::jsonb);

  select pl.entitlements
    into v_plan_entitlements
    from public.plans pl
   where pl.key = v_tier_key
   limit 1;

  if v_plan_entitlements is null then
    v_plan_entitlements := public.resolve_default_entitlements(v_tier_key);
  end if;

  return coalesce(v_plan_entitlements, '{}'::jsonb) || coalesce(v_override, '{}'::jsonb);
end;
$$;

create or replace function public.get_trip_limit_for_user(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_entitlements jsonb;
  v_limit_text text;
  v_limit integer;
begin
  v_entitlements := public.get_effective_entitlements(p_user_id);
  v_limit_text := v_entitlements ->> 'maxActiveTrips';
  if v_limit_text is null or btrim(v_limit_text) = '' then
    return 2147483647;
  end if;
  v_limit := v_limit_text::integer;
  return greatest(v_limit, 0);
exception
  when others then
    return 5;
end;
$$;

create or replace function public.get_trip_expiration_days_for_user(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_entitlements jsonb;
  v_days_text text;
  v_days integer;
begin
  v_entitlements := public.get_effective_entitlements(p_user_id);
  v_days_text := v_entitlements ->> 'tripExpirationDays';
  if v_days_text is null or btrim(v_days_text) = '' then
    return null;
  end if;
  v_days := v_days_text::integer;
  if v_days <= 0 then
    return null;
  end if;
  return v_days;
exception
  when others then
    return 14;
end;
$$;

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_email text;
  v_display_name text;
  v_is_admin boolean;
begin
  v_email := lower(coalesce(new.email, ''));
  v_display_name := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(v_email, '@', 1), 'Traveler');
  v_is_admin := exists (
    select 1
    from public.admin_allowlist a
    where lower(a.email) = v_email
      and a.is_active = true
  );

  insert into public.profiles (
    id,
    display_name,
    tier_key,
    system_role,
    entitlements_override
  )
  values (
    new.id,
    v_display_name,
    'tier_free',
    case when v_is_admin then 'admin' else 'user' end,
    '{}'::jsonb
  )
  on conflict (id) do update
  set
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    system_role = case
      when v_is_admin then 'admin'
      else public.profiles.system_role
    end;

  return new;
end;
$$;

drop trigger if exists sync_profile_from_auth_user on auth.users;
create trigger sync_profile_from_auth_user
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_profile_from_auth_user();

drop function if exists public.get_current_user_access();
create or replace function public.get_current_user_access()
returns table(
  user_id uuid,
  email text,
  is_anonymous boolean,
  system_role text,
  tier_key text,
  entitlements jsonb
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_uid uuid;
  v_email text;
  v_role text;
  v_tier text;
  v_is_anonymous boolean;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select u.email::text into v_email
    from auth.users u
   where u.id = v_uid;

  select p.system_role, p.tier_key
    into v_role, v_tier
    from public.profiles p
   where p.id = v_uid;

  v_is_anonymous := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);

  return query
  select
    v_uid,
    v_email,
    v_is_anonymous,
    coalesce(v_role, 'user'),
    coalesce(v_tier, 'tier_free'),
    public.get_effective_entitlements(v_uid);
end;
$$;

drop function if exists public.admin_list_users(integer, integer, text);
create or replace function public.admin_list_users(
  p_limit integer default 100,
  p_offset integer default 0,
  p_search text default null
)
returns table(
  user_id uuid,
  email text,
  system_role text,
  tier_key text,
  entitlements_override jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not allowed';
  end if;

  return query
  select
    p.id,
    u.email::text,
    p.system_role,
    p.tier_key,
    p.entitlements_override,
    p.created_at,
    p.updated_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  where (
    p_search is null
    or p_search = ''
    or coalesce(u.email, '') ilike ('%' || p_search || '%')
  )
  order by p.created_at desc
  limit greatest(coalesce(p_limit, 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_update_user_tier(
  p_user_id uuid,
  p_tier_key text
)
returns table(
  user_id uuid,
  tier_key text,
  role_updated_at timestamptz,
  role_updated_by uuid
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not allowed';
  end if;

  if not exists (
    select 1
    from public.plans pl
    where pl.key = p_tier_key
  ) then
    raise exception 'Unknown tier key';
  end if;

  update public.profiles p
     set tier_key = p_tier_key,
         role_updated_at = now(),
         role_updated_by = auth.uid()
   where p.id = p_user_id;

  return query
  select p.id, p.tier_key, p.role_updated_at, p.role_updated_by
    from public.profiles p
   where p.id = p_user_id;
end;
$$;

create or replace function public.admin_update_user_overrides(
  p_user_id uuid,
  p_overrides jsonb
)
returns table(
  user_id uuid,
  entitlements_override jsonb,
  role_updated_at timestamptz,
  role_updated_by uuid
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_overrides jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not allowed';
  end if;

  v_overrides := coalesce(p_overrides, '{}'::jsonb);
  if jsonb_typeof(v_overrides) <> 'object' then
    raise exception 'Override payload must be a JSON object';
  end if;

  update public.profiles p
     set entitlements_override = v_overrides,
         role_updated_at = now(),
         role_updated_by = auth.uid()
   where p.id = p_user_id;

  return query
  select p.id, p.entitlements_override, p.role_updated_at, p.role_updated_by
    from public.profiles p
   where p.id = p_user_id;
end;
$$;

create or replace function public.admin_update_plan_entitlements(
  p_tier_key text,
  p_entitlements jsonb
)
returns table(
  key text,
  entitlements jsonb,
  max_trips integer
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_entitlements jsonb;
  v_max_trips integer;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not allowed';
  end if;

  if not exists (
    select 1
    from public.plans pl
    where pl.key = p_tier_key
  ) then
    raise exception 'Unknown tier key';
  end if;

  v_entitlements := coalesce(p_entitlements, '{}'::jsonb);
  if jsonb_typeof(v_entitlements) <> 'object' then
    raise exception 'Entitlements payload must be a JSON object';
  end if;

  if v_entitlements ->> 'maxActiveTrips' is null then
    v_max_trips := 2147483647;
  else
    v_max_trips := greatest((v_entitlements ->> 'maxActiveTrips')::integer, 0);
  end if;

  update public.plans pl
     set entitlements = v_entitlements,
         max_trips = v_max_trips
   where pl.key = p_tier_key;

  return query
  select pl.key, pl.entitlements, pl.max_trips
    from public.plans pl
   where pl.key = p_tier_key;
end;
$$;

create or replace function public.log_auth_flow(
  p_flow_id text,
  p_attempt_id text,
  p_step text,
  p_result text,
  p_provider text default null,
  p_error_code text default null,
  p_email_hash text default null,
  p_ip_hash text default null,
  p_ua_hash text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_id uuid;
begin
  insert into public.auth_flow_logs (
    flow_id,
    attempt_id,
    step,
    result,
    provider,
    user_id,
    email_hash,
    ip_hash,
    ua_hash,
    error_code,
    metadata
  )
  values (
    p_flow_id,
    p_attempt_id,
    p_step,
    p_result,
    p_provider,
    auth.uid(),
    p_email_hash,
    p_ip_hash,
    p_ua_hash,
    p_error_code,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.create_trip_generation_request(
  p_flow text,
  p_payload jsonb,
  p_expires_in_days integer default 14
)
returns table(request_id uuid, status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_request_id uuid;
  v_days integer;
  v_expires_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_flow not in ('classic', 'wizard', 'surprise') then
    raise exception 'Invalid flow';
  end if;

  v_days := greatest(coalesce(p_expires_in_days, 14), 1);
  v_expires_at := now() + make_interval(days => v_days);

  insert into public.trip_generation_requests (
    requested_by_anon_id,
    flow,
    payload,
    status,
    expires_at
  )
  values (
    auth.uid(),
    p_flow,
    coalesce(p_payload, '{}'::jsonb),
    'pending_auth',
    v_expires_at
  )
  returning id into v_request_id;

  return query select v_request_id, 'pending_auth'::text, v_expires_at;
end;
$$;

create or replace function public.claim_trip_generation_request(
  p_request_id uuid
)
returns table(
  request_id uuid,
  flow text,
  payload jsonb,
  status text,
  owner_user_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.trip_generation_requests r
     set owner_user_id = v_user_id,
         status = 'queued',
         claimed_at = now(),
         updated_at = now()
   where r.id = p_request_id
     and r.status = 'pending_auth'
     and r.expires_at > now();

  return query
  select r.id, r.flow, r.payload, r.status, r.owner_user_id, r.expires_at
    from public.trip_generation_requests r
   where r.id = p_request_id
     and r.owner_user_id = v_user_id
   limit 1;
end;
$$;

create or replace function public.expire_stale_trip_generation_requests()
returns integer
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_count integer;
begin
  update public.trip_generation_requests r
     set status = 'expired',
         updated_at = now()
   where r.status in ('pending_auth', 'queued', 'running')
     and r.expires_at <= now();

  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$$;

create or replace function public.can_create_trip()
returns table(allow_create boolean, active_trip_count integer, max_trip_count integer)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_owner uuid;
  v_count integer;
  v_limit integer;
begin
  v_owner := auth.uid();
  if v_owner is null then
    raise exception 'Not authenticated';
  end if;

  v_limit := public.get_trip_limit_for_user(v_owner);

  select count(*)
    into v_count
    from public.trips t
   where t.owner_id = v_owner
     and coalesce(t.status, 'active') <> 'archived';

  if v_limit >= 2147483647 then
    return query select true, v_count, 2147483647;
    return;
  end if;

  return query
  select (v_count < v_limit), v_count, v_limit;
end;
$$;

create or replace function public.upsert_trip(
  p_id text,
  p_data jsonb,
  p_view jsonb,
  p_title text,
  p_start_date date,
  p_is_favorite boolean,
  p_forked_from_trip_id text,
  p_forked_from_share_token text,
  p_status text default 'active',
  p_trip_expires_at timestamptz default null,
  p_source_kind text default null,
  p_source_template_id text default null
)
returns table(trip_id text)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_owner uuid;
  v_limit integer;
  v_count integer;
  v_status text;
  v_trip_expires_at timestamptz;
  v_expiration_days integer;
begin
  v_owner := auth.uid();
  if v_owner is null then
    raise exception 'Not authenticated';
  end if;

  v_status := case
    when p_status in ('active', 'archived', 'expired') then p_status
    else 'active'
  end;

  if exists (select 1 from public.trips t where t.id = p_id) then
    if not exists (select 1 from public.trips t where t.id = p_id and t.owner_id = v_owner) then
      raise exception 'Not allowed';
    end if;

    update public.trips
       set data = p_data,
           view_settings = p_view,
           title = coalesce(p_title, title),
           start_date = coalesce(p_start_date, start_date),
           is_favorite = coalesce(p_is_favorite, is_favorite),
           forked_from_trip_id = coalesce(p_forked_from_trip_id, forked_from_trip_id),
           forked_from_share_token = coalesce(p_forked_from_share_token, forked_from_share_token),
           status = coalesce(v_status, status),
           trip_expires_at = coalesce(p_trip_expires_at, trip_expires_at),
           source_kind = coalesce(p_source_kind, source_kind),
           source_template_id = coalesce(p_source_template_id, source_template_id),
           updated_at = now()
     where id = p_id;
  else
    v_limit := public.get_trip_limit_for_user(v_owner);
    select count(*)
      into v_count
      from public.trips t
     where t.owner_id = v_owner
       and coalesce(t.status, 'active') <> 'archived';
    if v_limit < 2147483647 and v_count >= v_limit then
      raise exception 'Trip limit reached';
    end if;

    v_expiration_days := public.get_trip_expiration_days_for_user(v_owner);
    v_trip_expires_at := p_trip_expires_at;
    if v_trip_expires_at is null and v_expiration_days is not null then
      v_trip_expires_at := now() + make_interval(days => v_expiration_days);
    end if;

    insert into public.trips (
      id,
      owner_id,
      title,
      start_date,
      data,
      view_settings,
      is_favorite,
      status,
      trip_expires_at,
      source_kind,
      source_template_id,
      forked_from_trip_id,
      forked_from_share_token
    )
    values (
      p_id,
      v_owner,
      coalesce(p_title, 'Untitled trip'),
      p_start_date,
      p_data,
      p_view,
      coalesce(p_is_favorite, false),
      v_status,
      v_trip_expires_at,
      p_source_kind,
      p_source_template_id,
      p_forked_from_trip_id,
      p_forked_from_share_token
    );
  end if;

  return query select p_id as trip_id;
end;
$$;

alter table public.auth_flow_logs enable row level security;
alter table public.trip_generation_requests enable row level security;
alter table public.admin_allowlist enable row level security;

drop policy if exists "Auth flow logs admin read" on public.auth_flow_logs;
create policy "Auth flow logs admin read"
on public.auth_flow_logs for select
using (public.is_admin(auth.uid()));

drop policy if exists "Trip generation requests owner read" on public.trip_generation_requests;
create policy "Trip generation requests owner read"
on public.trip_generation_requests for select
using (requested_by_anon_id = auth.uid() or owner_user_id = auth.uid());

drop policy if exists "Trip generation requests owner insert" on public.trip_generation_requests;
create policy "Trip generation requests owner insert"
on public.trip_generation_requests for insert
with check (auth.uid() is not null and requested_by_anon_id = auth.uid());

drop policy if exists "Trip generation requests owner update" on public.trip_generation_requests;
create policy "Trip generation requests owner update"
on public.trip_generation_requests for update
using (requested_by_anon_id = auth.uid() or owner_user_id = auth.uid())
with check (requested_by_anon_id = auth.uid() or owner_user_id = auth.uid());

drop policy if exists "Admin allowlist admin manage" on public.admin_allowlist;
create policy "Admin allowlist admin manage"
on public.admin_allowlist for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

grant execute on function public.get_current_user_access() to anon, authenticated;
grant execute on function public.admin_list_users(integer, integer, text) to authenticated;
grant execute on function public.admin_update_user_tier(uuid, text) to authenticated;
grant execute on function public.admin_update_user_overrides(uuid, jsonb) to authenticated;
grant execute on function public.admin_update_plan_entitlements(text, jsonb) to authenticated;
grant execute on function public.log_auth_flow(text, text, text, text, text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.create_trip_generation_request(text, jsonb, integer) to anon, authenticated;
grant execute on function public.claim_trip_generation_request(uuid) to authenticated;
grant execute on function public.expire_stale_trip_generation_requests() to anon, authenticated;
grant execute on function public.get_effective_entitlements(uuid) to anon, authenticated;

-- =============================================================================
-- Admin IAM + profile onboarding extensions
-- =============================================================================

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists preferred_language text default 'en';
alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles add column if not exists disabled_at timestamptz;
alter table public.profiles add column if not exists disabled_by uuid references auth.users on delete set null;
alter table public.profiles add column if not exists onboarding_completed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_account_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_account_status_check
      check (account_status in ('active', 'disabled', 'deleted'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_gender_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_gender_check
      check (gender is null or gender in ('female', 'male', 'non-binary', 'prefer-not'));
  end if;
end;
$$;

create unique index if not exists profiles_username_uidx
  on public.profiles (lower(username))
  where username is not null and btrim(username) <> '';
create index if not exists profiles_account_status_idx on public.profiles(account_status);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  before_data jsonb not null default '{}'::jsonb,
  after_data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_at_idx on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_actor_idx on public.admin_audit_logs(actor_user_id, created_at desc);
create index if not exists admin_audit_logs_target_idx on public.admin_audit_logs(target_type, target_id, created_at desc);
create index if not exists admin_audit_logs_action_idx on public.admin_audit_logs(action, created_at desc);

create table if not exists public.admin_roles (
  key text primary key,
  label text not null,
  description text not null default '',
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_permissions (
  key text primary key,
  label text not null,
  domain text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.admin_role_permissions (
  role_key text not null references public.admin_roles(key) on delete cascade,
  permission_key text not null references public.admin_permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

create table if not exists public.admin_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null references public.admin_roles(key) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null,
  primary key (user_id, role_key)
);

create index if not exists admin_user_roles_role_key_idx on public.admin_user_roles(role_key, user_id);
create index if not exists admin_role_permissions_permission_idx on public.admin_role_permissions(permission_key, role_key);

insert into public.admin_roles (key, label, description)
values
  ('super_admin', 'Super Admin', 'Full administrative control across all IAM and entitlement operations.'),
  ('support_admin', 'Support Admin', 'Operational support access for user and trip lifecycle management.'),
  ('read_only_admin', 'Read-only Admin', 'Read-only visibility into admin operational data.')
on conflict (key) do update
set
  label = excluded.label,
  description = excluded.description;

insert into public.admin_permissions (key, label, domain, description)
values
  ('users.read', 'Read users', 'users', 'List and inspect user account/profile records.'),
  ('users.write', 'Write users', 'users', 'Update user profile, role, tier, and entitlement overrides.'),
  ('users.delete_soft', 'Soft-delete users', 'users', 'Set user account status to deleted/disabled and restore later.'),
  ('users.delete_hard', 'Hard-delete users', 'users', 'Permanently delete user auth/profile records.'),
  ('trips.read', 'Read trips', 'trips', 'List and inspect trip records across users.'),
  ('trips.write', 'Write trips', 'trips', 'Update trip status, expiration, and ownership metadata.'),
  ('tiers.read', 'Read tiers', 'tiers', 'Inspect tier templates and entitlement baselines.'),
  ('tiers.write', 'Write tiers', 'tiers', 'Update tier entitlement templates and max-trip policies.'),
  ('tiers.reapply', 'Reapply tiers', 'tiers', 'Run tier backfill/reapply operations against existing users/trips.'),
  ('audit.read', 'Read audit log', 'audit', 'Read immutable admin audit trail entries.'),
  ('audit.write', 'Write audit log', 'audit', 'Write immutable admin audit entries.'),
  ('admin.identity.write', 'Manage admin identity actions', 'identity', 'Run invite/direct-create/hard-delete identity operations.')
on conflict (key) do update
set
  label = excluded.label,
  domain = excluded.domain,
  description = excluded.description;

insert into public.admin_role_permissions (role_key, permission_key)
select 'super_admin', p.key
from public.admin_permissions p
on conflict (role_key, permission_key) do nothing;

insert into public.admin_role_permissions (role_key, permission_key)
values
  ('support_admin', 'users.read'),
  ('support_admin', 'users.write'),
  ('support_admin', 'users.delete_soft'),
  ('support_admin', 'trips.read'),
  ('support_admin', 'trips.write'),
  ('support_admin', 'tiers.read'),
  ('support_admin', 'audit.read'),
  ('support_admin', 'audit.write')
on conflict (role_key, permission_key) do nothing;

insert into public.admin_role_permissions (role_key, permission_key)
values
  ('read_only_admin', 'users.read'),
  ('read_only_admin', 'trips.read'),
  ('read_only_admin', 'tiers.read'),
  ('read_only_admin', 'audit.read')
on conflict (role_key, permission_key) do nothing;

alter table public.admin_roles enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admin_user_roles enable row level security;

drop policy if exists "Admin roles admin read" on public.admin_roles;
create policy "Admin roles admin read"
on public.admin_roles for select
using (public.is_admin(auth.uid()));

drop policy if exists "Admin permissions admin read" on public.admin_permissions;
create policy "Admin permissions admin read"
on public.admin_permissions for select
using (public.is_admin(auth.uid()));

drop policy if exists "Admin role permissions admin read" on public.admin_role_permissions;
create policy "Admin role permissions admin read"
on public.admin_role_permissions for select
using (public.is_admin(auth.uid()));

drop policy if exists "Admin user roles admin read" on public.admin_user_roles;
create policy "Admin user roles admin read"
on public.admin_user_roles for select
using (public.is_admin(auth.uid()));

drop policy if exists "Admin user roles admin manage" on public.admin_user_roles;
create policy "Admin user roles admin manage"
on public.admin_user_roles for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create or replace function public.has_admin_permission(
  p_permission text,
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_uid uuid;
  v_permission text;
  v_has_assigned_role boolean;
begin
  v_uid := coalesce(p_user_id, auth.uid());
  v_permission := nullif(btrim(p_permission), '');

  if v_uid is null or v_permission is null then
    return false;
  end if;

  if not public.is_admin(v_uid) then
    return false;
  end if;

  select exists(
    select 1
    from public.admin_user_roles ur
    where ur.user_id = v_uid
  )
  into v_has_assigned_role;

  -- Backward compatibility: legacy admins without explicit role assignment keep full access.
  if not v_has_assigned_role then
    return true;
  end if;

  return exists(
    select 1
    from public.admin_user_roles ur
    join public.admin_role_permissions rp
      on rp.role_key = ur.role_key
   where ur.user_id = v_uid
     and rp.permission_key = v_permission
  );
end;
$$;

alter table public.admin_audit_logs enable row level security;

drop policy if exists "Admin audit logs admin read" on public.admin_audit_logs;
create policy "Admin audit logs admin read"
on public.admin_audit_logs for select
using (public.is_admin(auth.uid()));

create or replace function public.guard_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if auth.uid() = old.id and not public.is_admin(auth.uid()) then
    new.system_role := old.system_role;
    new.tier_key := old.tier_key;
    new.entitlements_override := old.entitlements_override;
    new.role_updated_at := old.role_updated_at;
    new.role_updated_by := old.role_updated_by;
    new.account_status := old.account_status;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_privileged_fields on public.profiles;
create trigger guard_profile_privileged_fields
before update on public.profiles
for each row execute function public.guard_profile_privileged_fields();

create or replace function public.admin_write_audit(
  p_action text,
  p_target_type text,
  p_target_id text default null,
  p_before_data jsonb default '{}'::jsonb,
  p_after_data jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_id uuid;
begin
  if not public.has_admin_permission('audit.write') then
    raise exception 'Not allowed';
  end if;

  insert into public.admin_audit_logs (
    actor_user_id,
    action,
    target_type,
    target_id,
    before_data,
    after_data,
    metadata
  )
  values (
    auth.uid(),
    coalesce(nullif(btrim(p_action), ''), 'admin.unknown'),
    coalesce(nullif(btrim(p_target_type), ''), 'unknown'),
    p_target_id,
    coalesce(p_before_data, '{}'::jsonb),
    coalesce(p_after_data, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

drop function if exists public.get_current_user_access();
create or replace function public.get_current_user_access()
returns table(
  user_id uuid,
  email text,
  is_anonymous boolean,
  system_role text,
  tier_key text,
  entitlements jsonb,
  account_status text,
  onboarding_completed boolean
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_uid uuid;
  v_email text;
  v_role text;
  v_tier text;
  v_is_anonymous boolean;
  v_account_status text;
  v_onboarding_completed boolean;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select u.email::text into v_email
    from auth.users u
   where u.id = v_uid;

  select
    p.system_role,
    p.tier_key,
    p.account_status,
    (
      p.onboarding_completed_at is not null
      and coalesce(btrim(p.first_name), '') <> ''
      and coalesce(btrim(p.last_name), '') <> ''
      and coalesce(btrim(p.country), '') <> ''
      and coalesce(btrim(p.city), '') <> ''
      and coalesce(btrim(p.preferred_language), '') <> ''
    )
    into v_role, v_tier, v_account_status, v_onboarding_completed
    from public.profiles p
   where p.id = v_uid;

  v_is_anonymous := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);

  return query
  select
    v_uid,
    v_email,
    v_is_anonymous,
    coalesce(v_role, 'user'),
    coalesce(v_tier, 'tier_free'),
    public.get_effective_entitlements(v_uid),
    coalesce(v_account_status, 'active'),
    coalesce(v_onboarding_completed, false);
end;
$$;

drop function if exists public.admin_list_users(integer, integer, text);
create or replace function public.admin_list_users(
  p_limit integer default 100,
  p_offset integer default 0,
  p_search text default null
)
returns table(
  user_id uuid,
  email text,
  is_anonymous boolean,
  auth_provider text,
  last_sign_in_at timestamptz,
  display_name text,
  first_name text,
  last_name text,
  username text,
  gender text,
  country text,
  city text,
  preferred_language text,
  account_status text,
  disabled_at timestamptz,
  disabled_by uuid,
  onboarding_completed_at timestamptz,
  system_role text,
  tier_key text,
  entitlements_override jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
begin
  if not public.has_admin_permission('users.read') then
    raise exception 'Not allowed';
  end if;

  return query
  select
    p.id,
    u.email::text,
    (u.id is null or coalesce((u.raw_app_meta_data ->> 'provider') = 'anonymous', false))::boolean,
    (
      case
        when u.id is null then 'placeholder'
        else coalesce(nullif(u.raw_app_meta_data ->> 'provider', ''), case when u.email is not null then 'email' else 'unknown' end)
      end
    )::text,
    u.last_sign_in_at::timestamptz,
    p.display_name,
    p.first_name,
    p.last_name,
    p.username,
    p.gender,
    p.country,
    p.city,
    p.preferred_language,
    p.account_status,
    p.disabled_at,
    p.disabled_by,
    p.onboarding_completed_at,
    p.system_role,
    p.tier_key,
    p.entitlements_override,
    p.created_at,
    p.updated_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  where (
    p_search is null
    or p_search = ''
    or coalesce(u.email, '') ilike ('%' || p_search || '%')
    or coalesce(p.first_name, '') ilike ('%' || p_search || '%')
    or coalesce(p.last_name, '') ilike ('%' || p_search || '%')
    or coalesce(p.username, '') ilike ('%' || p_search || '%')
    or p.id::text ilike ('%' || p_search || '%')
  )
  order by p.created_at desc
  limit greatest(coalesce(p_limit, 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

drop function if exists public.admin_get_user_profile(uuid);
create or replace function public.admin_get_user_profile(
  p_user_id uuid
)
returns table(
  user_id uuid,
  email text,
  is_anonymous boolean,
  auth_provider text,
  last_sign_in_at timestamptz,
  display_name text,
  first_name text,
  last_name text,
  username text,
  gender text,
  country text,
  city text,
  preferred_language text,
  account_status text,
  disabled_at timestamptz,
  disabled_by uuid,
  onboarding_completed_at timestamptz,
  system_role text,
  tier_key text,
  entitlements_override jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
begin
  if not public.has_admin_permission('users.read') then
    raise exception 'Not allowed';
  end if;

  return query
  select
    p.id,
    u.email::text,
    (u.id is null or coalesce((u.raw_app_meta_data ->> 'provider') = 'anonymous', false))::boolean,
    (
      case
        when u.id is null then 'placeholder'
        else coalesce(nullif(u.raw_app_meta_data ->> 'provider', ''), case when u.email is not null then 'email' else 'unknown' end)
      end
    )::text,
    u.last_sign_in_at::timestamptz,
    p.display_name,
    p.first_name,
    p.last_name,
    p.username,
    p.gender,
    p.country,
    p.city,
    p.preferred_language,
    p.account_status,
    p.disabled_at,
    p.disabled_by,
    p.onboarding_completed_at,
    p.system_role,
    p.tier_key,
    p.entitlements_override,
    p.created_at,
    p.updated_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.id = p_user_id
  limit 1;
end;
$$;

create or replace function public.admin_update_user_profile(
  p_user_id uuid,
  p_first_name text default null,
  p_last_name text default null,
  p_username text default null,
  p_gender text default null,
  p_country text default null,
  p_city text default null,
  p_preferred_language text default null,
  p_account_status text default null,
  p_system_role text default null,
  p_tier_key text default null
)
returns table(
  user_id uuid,
  email text,
  system_role text,
  tier_key text,
  account_status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if not public.has_admin_permission('users.write') then
    raise exception 'Not allowed';
  end if;

  if p_system_role is not null and p_system_role not in ('admin', 'user') then
    raise exception 'Invalid system role';
  end if;

  if p_account_status is not null and p_account_status not in ('active', 'disabled', 'deleted') then
    raise exception 'Invalid account status';
  end if;

  if p_tier_key is not null and not exists (
    select 1 from public.plans pl where pl.key = p_tier_key
  ) then
    raise exception 'Unknown tier key';
  end if;

  select to_jsonb(p)
    into v_before
    from public.profiles p
   where p.id = p_user_id;

  if v_before is null then
    raise exception 'User profile not found';
  end if;

  update public.profiles p
     set first_name = coalesce(p_first_name, p.first_name),
         last_name = coalesce(p_last_name, p.last_name),
         username = coalesce(p_username, p.username),
         gender = coalesce(p_gender, p.gender),
         country = coalesce(p_country, p.country),
         city = coalesce(p_city, p.city),
         preferred_language = coalesce(p_preferred_language, p.preferred_language),
         account_status = coalesce(p_account_status, p.account_status),
         disabled_at = case
           when coalesce(p_account_status, p.account_status) = 'disabled' then coalesce(p.disabled_at, now())
           when p_account_status is not null and p_account_status <> 'disabled' then null
           else p.disabled_at
         end,
         disabled_by = case
           when coalesce(p_account_status, p.account_status) = 'disabled' then coalesce(p.disabled_by, auth.uid())
           when p_account_status is not null and p_account_status <> 'disabled' then null
           else p.disabled_by
         end,
         system_role = coalesce(p_system_role, p.system_role),
         tier_key = coalesce(p_tier_key, p.tier_key),
         display_name = coalesce(
           nullif(btrim(concat_ws(' ', coalesce(p_first_name, p.first_name), coalesce(p_last_name, p.last_name))), ''),
           p.display_name
         ),
         role_updated_at = now(),
         role_updated_by = auth.uid()
   where p.id = p_user_id;

  select to_jsonb(p)
    into v_after
    from public.profiles p
   where p.id = p_user_id;

  perform public.admin_write_audit(
    'admin.user.update_profile',
    'user',
    p_user_id::text,
    v_before,
    v_after,
    jsonb_build_object('updated_by', auth.uid())
  );

  return query
  select
    p.id,
    u.email::text,
    p.system_role,
    p.tier_key,
    p.account_status,
    p.updated_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.id = p_user_id;
end;
$$;

create or replace function public.admin_list_trips(
  p_limit integer default 200,
  p_offset integer default 0,
  p_search text default null,
  p_owner_id uuid default null,
  p_status text default null
)
returns table(
  trip_id text,
  owner_id uuid,
  owner_email text,
  title text,
  status text,
  trip_expires_at timestamptz,
  archived_at timestamptz,
  source_kind text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
begin
  if not public.has_admin_permission('trips.read') then
    raise exception 'Not allowed';
  end if;

  return query
  select
    t.id,
    t.owner_id,
    u.email::text,
    t.title,
    coalesce(t.status, 'active'),
    t.trip_expires_at,
    t.archived_at,
    t.source_kind,
    t.created_at,
    t.updated_at
  from public.trips t
  left join auth.users u on u.id = t.owner_id
  where (
    p_owner_id is null or t.owner_id = p_owner_id
  )
  and (
    p_status is null or p_status = '' or coalesce(t.status, 'active') = p_status
  )
  and (
    p_search is null
    or p_search = ''
    or coalesce(t.title, '') ilike ('%' || p_search || '%')
    or t.id ilike ('%' || p_search || '%')
    or coalesce(u.email, '') ilike ('%' || p_search || '%')
  )
  order by t.updated_at desc
  limit greatest(coalesce(p_limit, 200), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_list_user_trips(
  p_user_id uuid,
  p_limit integer default 200,
  p_offset integer default 0,
  p_status text default null
)
returns table(
  trip_id text,
  owner_id uuid,
  owner_email text,
  title text,
  status text,
  trip_expires_at timestamptz,
  archived_at timestamptz,
  source_kind text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
begin
  if not public.has_admin_permission('trips.read') then
    raise exception 'Not allowed';
  end if;

  return query
  select
    t.id,
    t.owner_id,
    u.email::text,
    t.title,
    coalesce(t.status, 'active'),
    t.trip_expires_at,
    t.archived_at,
    t.source_kind,
    t.created_at,
    t.updated_at
  from public.trips t
  left join auth.users u on u.id = t.owner_id
  where t.owner_id = p_user_id
    and (p_status is null or p_status = '' or coalesce(t.status, 'active') = p_status)
  order by t.updated_at desc
  limit greatest(coalesce(p_limit, 200), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_update_trip(
  p_trip_id text,
  p_status text default null,
  p_trip_expires_at timestamptz default null,
  p_owner_id uuid default null,
  p_apply_status boolean default false,
  p_apply_trip_expires_at boolean default false,
  p_apply_owner_id boolean default false
)
returns table(
  trip_id text,
  owner_id uuid,
  status text,
  trip_expires_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if not public.has_admin_permission('trips.write') then
    raise exception 'Not allowed';
  end if;

  if p_apply_status and p_status is not null and p_status not in ('active', 'archived', 'expired') then
    raise exception 'Invalid trip status';
  end if;

  if p_apply_owner_id and p_owner_id is not null and not exists (
    select 1 from auth.users u where u.id = p_owner_id
  ) then
    raise exception 'New owner does not exist';
  end if;

  select to_jsonb(t)
    into v_before
    from public.trips t
   where t.id = p_trip_id;

  if v_before is null then
    raise exception 'Trip not found';
  end if;

  update public.trips t
     set status = case
           when p_apply_status then coalesce(p_status, t.status)
           else t.status
         end,
         trip_expires_at = case
           when p_apply_trip_expires_at then p_trip_expires_at
           else t.trip_expires_at
         end,
         owner_id = case
           when p_apply_owner_id and p_owner_id is not null then p_owner_id
           else t.owner_id
         end,
         archived_at = case
           when p_apply_status and p_status = 'archived' then coalesce(t.archived_at, now())
           when p_apply_status and p_status <> 'archived' then null
           else t.archived_at
         end,
         updated_at = now()
   where t.id = p_trip_id;

  select to_jsonb(t)
    into v_after
    from public.trips t
   where t.id = p_trip_id;

  perform public.admin_write_audit(
    'admin.trip.update',
    'trip',
    p_trip_id,
    v_before,
    v_after,
    jsonb_build_object(
      'apply_status', p_apply_status,
      'apply_trip_expires_at', p_apply_trip_expires_at,
      'apply_owner_id', p_apply_owner_id
    )
  );

  return query
  select
    t.id,
    t.owner_id,
    coalesce(t.status, 'active'),
    t.trip_expires_at,
    t.updated_at
  from public.trips t
  where t.id = p_trip_id;
end;
$$;

create or replace function public.admin_list_audit_logs(
  p_limit integer default 200,
  p_offset integer default 0,
  p_action text default null,
  p_target_type text default null,
  p_actor_user_id uuid default null
)
returns table(
  id uuid,
  actor_user_id uuid,
  actor_email text,
  action text,
  target_type text,
  target_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
begin
  if not public.has_admin_permission('audit.read') then
    raise exception 'Not allowed';
  end if;

  return query
  select
    l.id,
    l.actor_user_id,
    u.email::text,
    l.action,
    l.target_type,
    l.target_id,
    l.before_data,
    l.after_data,
    l.metadata,
    l.created_at
  from public.admin_audit_logs l
  left join auth.users u on u.id = l.actor_user_id
  where (p_action is null or p_action = '' or l.action = p_action)
    and (p_target_type is null or p_target_type = '' or l.target_type = p_target_type)
    and (p_actor_user_id is null or l.actor_user_id = p_actor_user_id)
  order by l.created_at desc
  limit greatest(coalesce(p_limit, 200), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_reapply_tier_to_users(
  p_tier_key text,
  p_apply_expiration_backfill boolean default true
)
returns table(
  affected_users integer,
  affected_trips integer
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user_count integer;
  v_trip_count integer := 0;
begin
  if not public.has_admin_permission('tiers.reapply') then
    raise exception 'Not allowed';
  end if;

  if not exists (select 1 from public.plans pl where pl.key = p_tier_key) then
    raise exception 'Unknown tier key';
  end if;

  select count(*)
    into v_user_count
    from public.profiles p
   where p.tier_key = p_tier_key;

  if p_apply_expiration_backfill then
    update public.trips t
       set trip_expires_at = case
             when x.exp_days is null then null
             else (coalesce(t.created_at, now()) + make_interval(days => x.exp_days))
           end,
           status = case
             when coalesce(t.status, 'active') = 'archived' then 'archived'
             when x.exp_days is not null and (coalesce(t.created_at, now()) + make_interval(days => x.exp_days)) <= now() then 'expired'
             else 'active'
           end,
           updated_at = now()
      from (
        select
          p.id as owner_id,
          public.get_trip_expiration_days_for_user(p.id) as exp_days
        from public.profiles p
        where p.tier_key = p_tier_key
      ) x
     where t.owner_id = x.owner_id;

    get diagnostics v_trip_count = row_count;
  end if;

  perform public.admin_write_audit(
    'admin.tier.reapply',
    'tier',
    p_tier_key,
    '{}'::jsonb,
    jsonb_build_object('affected_users', coalesce(v_user_count, 0), 'affected_trips', coalesce(v_trip_count, 0)),
    jsonb_build_object('apply_expiration_backfill', p_apply_expiration_backfill)
  );

  return query select coalesce(v_user_count, 0), coalesce(v_trip_count, 0);
end;
$$;

create or replace function public.admin_preview_tier_reapply(
  p_tier_key text
)
returns table(
  affected_users integer,
  affected_trips integer,
  active_trips integer,
  expired_trips integer,
  archived_trips integer,
  users_with_overrides integer
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.has_admin_permission('tiers.read') then
    raise exception 'Not allowed';
  end if;

  if not exists (select 1 from public.plans pl where pl.key = p_tier_key) then
    raise exception 'Unknown tier key';
  end if;

  return query
  with target_users as (
    select p.id as user_id, p.entitlements_override
    from public.profiles p
    where p.tier_key = p_tier_key
  ),
  target_trips as (
    select t.*
    from public.trips t
    join target_users u on u.user_id = t.owner_id
  )
  select
    (select count(*)::integer from target_users),
    (select count(*)::integer from target_trips),
    (select count(*)::integer from target_trips where coalesce(status, 'active') = 'active'),
    (select count(*)::integer from target_trips where coalesce(status, 'active') = 'expired'),
    (select count(*)::integer from target_trips where coalesce(status, 'active') = 'archived'),
    (
      select count(*)::integer
      from target_users
      where entitlements_override is not null
        and entitlements_override <> '{}'::jsonb
    );
end;
$$;

create or replace function public.admin_update_user_tier(
  p_user_id uuid,
  p_tier_key text
)
returns table(
  user_id uuid,
  tier_key text,
  role_updated_at timestamptz,
  role_updated_by uuid
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if not public.has_admin_permission('users.write') then
    raise exception 'Not allowed';
  end if;

  if not exists (
    select 1
    from public.plans pl
    where pl.key = p_tier_key
  ) then
    raise exception 'Unknown tier key';
  end if;

  select to_jsonb(p) into v_before from public.profiles p where p.id = p_user_id;

  update public.profiles p
     set tier_key = p_tier_key,
         role_updated_at = now(),
         role_updated_by = auth.uid()
   where p.id = p_user_id;

  select to_jsonb(p) into v_after from public.profiles p where p.id = p_user_id;
  perform public.admin_write_audit('admin.user.update_tier', 'user', p_user_id::text, v_before, v_after, jsonb_build_object('tier_key', p_tier_key));

  return query
  select p.id, p.tier_key, p.role_updated_at, p.role_updated_by
    from public.profiles p
   where p.id = p_user_id;
end;
$$;

create or replace function public.admin_update_user_overrides(
  p_user_id uuid,
  p_overrides jsonb
)
returns table(
  user_id uuid,
  entitlements_override jsonb,
  role_updated_at timestamptz,
  role_updated_by uuid
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_overrides jsonb;
  v_before jsonb;
  v_after jsonb;
begin
  if not public.has_admin_permission('users.write') then
    raise exception 'Not allowed';
  end if;

  v_overrides := coalesce(p_overrides, '{}'::jsonb);
  if jsonb_typeof(v_overrides) <> 'object' then
    raise exception 'Override payload must be a JSON object';
  end if;

  select to_jsonb(p) into v_before from public.profiles p where p.id = p_user_id;

  update public.profiles p
     set entitlements_override = v_overrides,
         role_updated_at = now(),
         role_updated_by = auth.uid()
   where p.id = p_user_id;

  select to_jsonb(p) into v_after from public.profiles p where p.id = p_user_id;
  perform public.admin_write_audit(
    'admin.user.update_overrides',
    'user',
    p_user_id::text,
    v_before,
    v_after,
    jsonb_build_object(
      'override_keys',
      coalesce((select jsonb_agg(k) from jsonb_object_keys(v_overrides) as k), '[]'::jsonb)
    )
  );

  return query
  select p.id, p.entitlements_override, p.role_updated_at, p.role_updated_by
    from public.profiles p
   where p.id = p_user_id;
end;
$$;

create or replace function public.admin_update_plan_entitlements(
  p_tier_key text,
  p_entitlements jsonb
)
returns table(
  key text,
  entitlements jsonb,
  max_trips integer
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_entitlements jsonb;
  v_max_trips integer;
  v_before jsonb;
  v_after jsonb;
begin
  if not public.has_admin_permission('tiers.write') then
    raise exception 'Not allowed';
  end if;

  if not exists (
    select 1
    from public.plans pl
    where pl.key = p_tier_key
  ) then
    raise exception 'Unknown tier key';
  end if;

  v_entitlements := coalesce(p_entitlements, '{}'::jsonb);
  if jsonb_typeof(v_entitlements) <> 'object' then
    raise exception 'Entitlements payload must be a JSON object';
  end if;

  if v_entitlements ->> 'maxActiveTrips' is null then
    v_max_trips := 2147483647;
  else
    v_max_trips := greatest((v_entitlements ->> 'maxActiveTrips')::integer, 0);
  end if;

  select to_jsonb(pl) into v_before from public.plans pl where pl.key = p_tier_key;

  update public.plans pl
     set entitlements = v_entitlements,
         max_trips = v_max_trips
   where pl.key = p_tier_key;

  select to_jsonb(pl) into v_after from public.plans pl where pl.key = p_tier_key;
  perform public.admin_write_audit('admin.tier.update_entitlements', 'tier', p_tier_key, v_before, v_after, jsonb_build_object('tier_key', p_tier_key));

  return query
  select pl.key, pl.entitlements, pl.max_trips
    from public.plans pl
   where pl.key = p_tier_key;
end;
$$;

grant execute on function public.get_current_user_access() to anon, authenticated;
grant execute on function public.has_admin_permission(text, uuid) to authenticated;
grant execute on function public.admin_write_audit(text, text, text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.admin_list_users(integer, integer, text) to authenticated;
grant execute on function public.admin_get_user_profile(uuid) to authenticated;
grant execute on function public.admin_update_user_profile(uuid, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_update_user_tier(uuid, text) to authenticated;
grant execute on function public.admin_update_user_overrides(uuid, jsonb) to authenticated;
grant execute on function public.admin_update_plan_entitlements(text, jsonb) to authenticated;
grant execute on function public.admin_list_trips(integer, integer, text, uuid, text) to authenticated;
grant execute on function public.admin_list_user_trips(uuid, integer, integer, text) to authenticated;
grant execute on function public.admin_update_trip(text, text, timestamptz, uuid, boolean, boolean, boolean) to authenticated;
grant execute on function public.admin_list_audit_logs(integer, integer, text, text, uuid) to authenticated;
grant execute on function public.admin_reapply_tier_to_users(text, boolean) to authenticated;
grant execute on function public.admin_preview_tier_reapply(text) to authenticated;
