-- Minimal stand-in for the tables the Trip Agent access and apply functions
-- touch, so a migration can be exercised on a throwaway Postgres before it is
-- applied to a project. Not a schema source of truth: see docs/supabase.sql.

create extension if not exists pgcrypto;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);

create table public.trips (
  id text primary key,
  owner_id uuid,
  status text not null default 'active',
  trip_expires_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  view_settings jsonb,
  title text,
  start_date date,
  updated_at timestamptz default now()
);
create table public.trip_collaborators (
  trip_id text references public.trips(id), user_id uuid, role text,
  primary key (trip_id, user_id)
);
create table public.trip_shares (
  id uuid primary key default gen_random_uuid(),
  trip_id text references public.trips(id), token text unique, mode text,
  revoked_at timestamptz, expires_at timestamptz
);
create table public.trip_versions (
  id uuid primary key default gen_random_uuid(),
  trip_id text, data jsonb, view_settings jsonb, label text, created_by uuid,
  created_at timestamptz default now()
);
create table public.trip_user_events (
  id uuid primary key default gen_random_uuid(),
  trip_id text, owner_id uuid, action text, source text, metadata jsonb
);
create table public.trip_agent_change_sets (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid, trip_id text, created_by uuid, schema_version int default 1,
  base_trip_updated_at bigint, summary text, operations jsonb default '[]'::jsonb,
  sources jsonb default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','applied','applied_partial','rejected','stale')),
  selected_operation_ids text[], applied_version_id uuid,
  applied_at timestamptz, rejected_at timestamptz
);
