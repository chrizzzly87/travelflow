-- One admin surface for the app-wide switches.
--
-- planner_beta_open, the AI model configuration and the Trip Agent rollout have
-- only ever been reachable by hand-written SQL. This adds the map default to
-- the same row and an admin-only writer, so /admin/settings can own all of it.

alter table public.app_runtime_settings
  add column if not exists map_default_style text not null default 'standard';

alter table public.app_runtime_settings
  add column if not exists map_runtime_preset text not null default 'google_all';

alter table public.app_runtime_settings
  drop constraint if exists app_runtime_settings_map_runtime_preset_check;
alter table public.app_runtime_settings
  add constraint app_runtime_settings_map_runtime_preset_check
  check (map_runtime_preset in ('google_all', 'mapbox_visual_google_services', 'mapbox_all'));

alter table public.app_runtime_settings
  drop constraint if exists app_runtime_settings_map_default_style_check;
alter table public.app_runtime_settings
  add constraint app_runtime_settings_map_default_style_check
  check (map_default_style in ('minimal', 'standard', 'dark', 'satellite', 'clean', 'cleanDark'));

drop function if exists public.get_public_runtime_settings();
create or replace function public.get_public_runtime_settings()
returns table(
  planner_beta_open boolean,
  ai_default_model_id text,
  ai_approved_openrouter_models text[],
  ai_model_max_age_months integer,
  ai_show_older_models boolean,
  trip_agent_enabled boolean,
  trip_agent_admin_preview boolean,
  map_default_style text,
  map_runtime_preset text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    ars.planner_beta_open,
    ars.ai_default_model_id,
    ars.ai_approved_openrouter_models,
    ars.ai_model_max_age_months,
    ars.ai_show_older_models,
    ars.trip_agent_enabled,
    ars.trip_agent_admin_preview,
    ars.map_default_style,
    ars.map_runtime_preset,
    ars.updated_at
  from public.app_runtime_settings ars
  where ars.singleton = true
  limit 1;
$$;

grant execute on function public.get_public_runtime_settings() to anon, authenticated;

-- Every argument is optional: null means "leave this setting alone", so the
-- admin page can save one section without shipping the whole row back.
drop function if exists public.admin_update_app_runtime_settings(boolean, boolean, boolean, text, text[], integer, boolean, text, text);
create or replace function public.admin_update_app_runtime_settings(
  p_planner_beta_open boolean default null,
  p_trip_agent_enabled boolean default null,
  p_trip_agent_admin_preview boolean default null,
  p_ai_default_model_id text default null,
  p_ai_approved_openrouter_models text[] default null,
  p_ai_model_max_age_months integer default null,
  p_ai_show_older_models boolean default null,
  p_map_default_style text default null,
  p_map_runtime_preset text default null
)
returns public.app_runtime_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_result public.app_runtime_settings%rowtype;
  v_default_model_id text := nullif(trim(coalesce(p_ai_default_model_id, '')), '');
  v_approved_models text[];
begin
  if not public.is_admin(v_uid) then
    raise exception 'Not allowed';
  end if;

  if v_default_model_id is not null and position(':' in v_default_model_id) = 0 then
    raise exception 'Invalid AI default model id';
  end if;

  if p_map_default_style is not null
     and p_map_default_style not in ('minimal', 'standard', 'dark', 'satellite', 'clean', 'cleanDark') then
    raise exception 'Invalid map style';
  end if;

  if p_map_runtime_preset is not null
     and p_map_runtime_preset not in ('google_all', 'mapbox_visual_google_services', 'mapbox_all') then
    raise exception 'Invalid map runtime preset';
  end if;

  if p_ai_approved_openrouter_models is not null then
    select coalesce(array_agg(distinct model_id order by model_id), '{}')
    into v_approved_models
    from unnest(p_ai_approved_openrouter_models) as model_id
    where model_id ~ '^[a-z0-9._-]+/[a-zA-Z0-9._:/-]+$';
  end if;

  update public.app_runtime_settings ars
  set
    planner_beta_open = coalesce(p_planner_beta_open, ars.planner_beta_open),
    trip_agent_enabled = coalesce(p_trip_agent_enabled, ars.trip_agent_enabled),
    trip_agent_admin_preview = coalesce(p_trip_agent_admin_preview, ars.trip_agent_admin_preview),
    ai_default_model_id = coalesce(v_default_model_id, ars.ai_default_model_id),
    ai_approved_openrouter_models = coalesce(v_approved_models, ars.ai_approved_openrouter_models),
    ai_model_max_age_months = coalesce(p_ai_model_max_age_months, ars.ai_model_max_age_months),
    ai_show_older_models = coalesce(p_ai_show_older_models, ars.ai_show_older_models),
    map_default_style = coalesce(p_map_default_style, ars.map_default_style),
    map_runtime_preset = coalesce(p_map_runtime_preset, ars.map_runtime_preset),
    updated_at = now()
  where ars.singleton = true
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_update_app_runtime_settings(boolean, boolean, boolean, text, text[], integer, boolean, text, text) from public, anon;
grant execute on function public.admin_update_app_runtime_settings(boolean, boolean, boolean, text, text[], integer, boolean, text, text) to authenticated;
