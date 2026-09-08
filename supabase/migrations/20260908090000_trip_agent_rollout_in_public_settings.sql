-- Trip Agent rollout state for the client.
--
-- The launcher was rendered for every signed-in editor while the server gate
-- (`assertTripAgentAvailable`) refused anyone who is not an administrator while
-- `trip_agent_enabled` is false, so the button opened a panel that could only
-- report an error. The public runtime settings already carry the app-wide model
-- configuration; the two rollout flags join them so the client can hide the
-- launcher until the feature is actually enabled.
--
-- Both columns already exist on `app_runtime_settings`
-- (`20260903110000_trip_agent_poc.sql`); this only widens the read function.

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
    ars.updated_at
  from public.app_runtime_settings ars
  where ars.singleton = true
  limit 1;
$$;

grant execute on function public.get_public_runtime_settings() to anon, authenticated;
