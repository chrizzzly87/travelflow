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

-- Forward-compatible schema upgrades
alter table public.trips add column if not exists sharing_enabled boolean not null default true;

-- Indexes
create index if not exists trips_owner_id_idx on public.trips(owner_id);
create index if not exists trips_updated_at_idx on public.trips(updated_at desc);
create index if not exists trips_forked_from_idx on public.trips(forked_from_trip_id);
create index if not exists trip_versions_trip_id_idx on public.trip_versions(trip_id);
create index if not exists trip_versions_created_at_idx on public.trip_versions(created_at desc);
create index if not exists trip_shares_trip_id_idx on public.trip_shares(trip_id);
create index if not exists trip_collaborators_user_id_idx on public.trip_collaborators(user_id);

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

-- RPC: Upsert trip with ownership enforcement
create or replace function public.upsert_trip(
  p_id text,
  p_data jsonb,
  p_view jsonb,
  p_title text,
  p_start_date date,
  p_is_favorite boolean,
  p_forked_from_trip_id text,
  p_forked_from_share_token text
)
returns table(trip_id text)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_owner uuid;
begin
  v_owner := auth.uid();
  if v_owner is null then
    raise exception 'Not authenticated';
  end if;

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
           updated_at = now()
     where id = p_id;
  else
    insert into public.trips (
      id,
      owner_id,
      title,
      start_date,
      data,
      view_settings,
      is_favorite,
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
grant execute on function public.upsert_trip(text, jsonb, jsonb, text, date, boolean, text, text) to anon, authenticated;
grant execute on function public.add_trip_version(text, jsonb, jsonb, text) to anon, authenticated;
