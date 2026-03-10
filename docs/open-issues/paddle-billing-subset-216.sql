-- Paddle billing schema subset (Issue #216)
-- Purpose: apply only the database changes required for Paddle checkout/webhook sync
-- before the broader docs/supabase.sql merge lands.
--
-- Preconditions:
-- - The base TravelFlow schema already exists (especially public.profiles and public.plans).
-- - This file is intended for existing projects that already ran an earlier docs/supabase.sql.
--
-- Notes:
-- - Safe to run multiple times.
-- - Includes current_period_end for existing public.subscriptions tables; the webhook code
--   already reads and writes this field.

begin;

-- Profile tier sync target used by the Paddle webhook.
alter table public.profiles add column if not exists tier_key text;
alter table public.profiles alter column tier_key set default 'tier_free';
update public.profiles
   set tier_key = 'tier_free'
 where tier_key is null;
alter table public.profiles alter column tier_key set not null;

-- Canonical subscription lifecycle row per user.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  plan_id uuid references public.plans(id),
  status text not null default 'active',
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  provider_price_id text,
  provider_product_id text,
  provider_status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  grace_ends_at timestamptz,
  currency text,
  amount integer,
  last_event_id text,
  last_event_type text,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions add column if not exists provider text;
alter table public.subscriptions add column if not exists provider_customer_id text;
alter table public.subscriptions add column if not exists provider_subscription_id text;
alter table public.subscriptions add column if not exists provider_price_id text;
alter table public.subscriptions add column if not exists provider_product_id text;
alter table public.subscriptions add column if not exists provider_status text;
alter table public.subscriptions add column if not exists current_period_start timestamptz;
alter table public.subscriptions add column if not exists current_period_end timestamptz;
alter table public.subscriptions add column if not exists cancel_at timestamptz;
alter table public.subscriptions add column if not exists canceled_at timestamptz;
alter table public.subscriptions add column if not exists grace_ends_at timestamptz;
alter table public.subscriptions add column if not exists currency text;
alter table public.subscriptions add column if not exists amount integer;
alter table public.subscriptions add column if not exists last_event_id text;
alter table public.subscriptions add column if not exists last_event_type text;
alter table public.subscriptions add column if not exists last_event_at timestamptz;
alter table public.subscriptions add column if not exists created_at timestamptz;
alter table public.subscriptions add column if not exists updated_at timestamptz;
update public.subscriptions
   set created_at = now()
 where created_at is null;
update public.subscriptions
   set updated_at = now()
 where updated_at is null;
alter table public.subscriptions alter column created_at set default now();
alter table public.subscriptions alter column created_at set not null;
alter table public.subscriptions alter column updated_at set default now();
alter table public.subscriptions alter column updated_at set not null;

-- Webhook idempotency + replay/debug log.
create table if not exists public.billing_webhook_events (
  event_id text primary key,
  provider text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  user_id uuid references auth.users on delete set null,
  status text not null default 'received',
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.billing_webhook_events add column if not exists provider text;
alter table public.billing_webhook_events add column if not exists event_type text;
alter table public.billing_webhook_events add column if not exists occurred_at timestamptz;
alter table public.billing_webhook_events add column if not exists user_id uuid references auth.users on delete set null;
update public.billing_webhook_events
   set provider = 'paddle'
 where provider is null;
update public.billing_webhook_events
   set event_type = 'unknown'
 where event_type is null;
update public.billing_webhook_events
   set occurred_at = coalesce(occurred_at, now())
 where occurred_at is null;
alter table public.billing_webhook_events alter column provider set not null;
alter table public.billing_webhook_events alter column event_type set not null;
alter table public.billing_webhook_events alter column occurred_at set not null;
alter table public.billing_webhook_events add column if not exists status text;
alter table public.billing_webhook_events alter column status set default 'received';
update public.billing_webhook_events
   set status = 'received'
 where status is null;
alter table public.billing_webhook_events alter column status set not null;
alter table public.billing_webhook_events add column if not exists error_message text;
alter table public.billing_webhook_events add column if not exists payload jsonb;
alter table public.billing_webhook_events alter column payload set default '{}'::jsonb;
update public.billing_webhook_events
   set payload = '{}'::jsonb
 where payload is null;
alter table public.billing_webhook_events alter column payload set not null;
alter table public.billing_webhook_events add column if not exists processed_at timestamptz;
alter table public.billing_webhook_events add column if not exists created_at timestamptz;
update public.billing_webhook_events
   set created_at = now()
 where created_at is null;
alter table public.billing_webhook_events alter column created_at set default now();
alter table public.billing_webhook_events alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'billing_webhook_events_status_check'
      and conrelid = 'public.billing_webhook_events'::regclass
  ) then
    alter table public.billing_webhook_events
      add constraint billing_webhook_events_status_check
      check (status in ('received', 'processed', 'ignored', 'failed'));
  end if;
end;
$$;

create unique index if not exists subscriptions_provider_subscription_uidx
  on public.subscriptions(provider_subscription_id)
  where provider_subscription_id is not null;
create index if not exists subscriptions_provider_customer_idx on public.subscriptions(provider_customer_id);
create index if not exists subscriptions_last_event_at_idx on public.subscriptions(last_event_at desc);
create index if not exists billing_webhook_events_occurred_at_idx on public.billing_webhook_events(occurred_at desc);
create index if not exists billing_webhook_events_user_occurred_at_idx on public.billing_webhook_events(user_id, occurred_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;
alter table public.billing_webhook_events enable row level security;

drop policy if exists "Subscriptions are user-owned" on public.subscriptions;
create policy "Subscriptions are user-owned"
on public.subscriptions for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Billing webhook events are user-owned" on public.billing_webhook_events;
create policy "Billing webhook events are user-owned"
on public.billing_webhook_events for select
using (user_id = auth.uid());

-- Admin workspace billing visibility.
insert into public.admin_permissions (key, label, domain, description)
values
  ('billing.read', 'Read billing', 'billing', 'Inspect subscription state and billing webhook delivery records.')
on conflict (key) do update
set
  label = excluded.label,
  domain = excluded.domain,
  description = excluded.description;

insert into public.admin_role_permissions (role_key, permission_key)
values
  ('support_admin', 'billing.read'),
  ('read_only_admin', 'billing.read')
on conflict (role_key, permission_key) do nothing;

insert into public.admin_role_permissions (role_key, permission_key)
select 'super_admin', 'billing.read'
where exists (
  select 1
  from public.admin_roles r
  where r.key = 'super_admin'
)
on conflict (role_key, permission_key) do nothing;

create or replace function public.admin_list_billing_subscriptions(
  p_limit integer default 250,
  p_offset integer default 0,
  p_search text default null
)
returns table(
  user_id uuid,
  email text,
  tier_key text,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  provider_price_id text,
  provider_status text,
  subscription_status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  grace_ends_at timestamptz,
  currency text,
  amount integer,
  last_event_id text,
  last_event_type text,
  last_event_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
begin
  if not public.has_admin_permission('billing.read') then
    raise exception 'Not allowed';
  end if;

  return query
  select
    s.user_id,
    u.email::text,
    p.tier_key,
    s.provider,
    s.provider_customer_id,
    s.provider_subscription_id,
    s.provider_price_id,
    s.provider_status,
    s.status as subscription_status,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at,
    s.canceled_at,
    s.grace_ends_at,
    s.currency,
    s.amount,
    s.last_event_id,
    s.last_event_type,
    s.last_event_at,
    s.created_at,
    s.updated_at
  from public.subscriptions s
  left join public.profiles p on p.id = s.user_id
  left join auth.users u on u.id = s.user_id
  where (
    p_search is null
    or p_search = ''
    or s.user_id::text ilike ('%' || p_search || '%')
    or coalesce(u.email, '') ilike ('%' || p_search || '%')
    or coalesce(s.provider_subscription_id, '') ilike ('%' || p_search || '%')
    or coalesce(s.provider_customer_id, '') ilike ('%' || p_search || '%')
    or coalesce(s.provider_status, '') ilike ('%' || p_search || '%')
    or coalesce(s.last_event_type, '') ilike ('%' || p_search || '%')
    or coalesce(p.tier_key, '') ilike ('%' || p_search || '%')
  )
  order by coalesce(s.updated_at, s.created_at) desc
  limit greatest(coalesce(p_limit, 250), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_list_billing_webhook_events(
  p_limit integer default 250,
  p_offset integer default 0,
  p_search text default null
)
returns table(
  event_id text,
  provider text,
  event_type text,
  occurred_at timestamptz,
  user_id uuid,
  user_email text,
  status text,
  error_message text,
  payload jsonb,
  processed_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
begin
  if not public.has_admin_permission('billing.read') then
    raise exception 'Not allowed';
  end if;

  return query
  select
    e.event_id,
    e.provider,
    e.event_type,
    e.occurred_at,
    e.user_id,
    u.email::text as user_email,
    e.status,
    e.error_message,
    e.payload,
    e.processed_at,
    e.created_at
  from public.billing_webhook_events e
  left join auth.users u on u.id = e.user_id
  where (
    p_search is null
    or p_search = ''
    or e.event_id ilike ('%' || p_search || '%')
    or coalesce(u.email, '') ilike ('%' || p_search || '%')
    or coalesce(e.user_id::text, '') ilike ('%' || p_search || '%')
    or coalesce(e.event_type, '') ilike ('%' || p_search || '%')
    or coalesce(e.status, '') ilike ('%' || p_search || '%')
    or coalesce(e.error_message, '') ilike ('%' || p_search || '%')
    or coalesce(e.payload::text, '') ilike ('%' || p_search || '%')
  )
  order by e.occurred_at desc, e.created_at desc
  limit greatest(coalesce(p_limit, 250), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

grant execute on function public.admin_list_billing_subscriptions(integer, integer, text) to authenticated;
grant execute on function public.admin_list_billing_webhook_events(integer, integer, text) to authenticated;

-- Current-user billing summary for pricing, checkout, and profile billing management.
drop function if exists public.get_current_user_subscription_summary();
create or replace function public.get_current_user_subscription_summary()
returns table(
  user_id uuid,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  provider_price_id text,
  provider_product_id text,
  provider_status text,
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  grace_ends_at timestamptz,
  currency text,
  amount integer,
  last_event_id text,
  last_event_type text,
  last_event_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    s.user_id,
    s.provider,
    s.provider_customer_id,
    s.provider_subscription_id,
    s.provider_price_id,
    s.provider_product_id,
    s.provider_status,
    s.status,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at,
    s.canceled_at,
    s.grace_ends_at,
    s.currency,
    s.amount,
    s.last_event_id,
    s.last_event_type,
    s.last_event_at
  from public.subscriptions s
  where s.user_id = v_uid
  order by coalesce(s.updated_at, s.created_at) desc
  limit 1;
end;
$$;


-- Surface billing status and subscription detail in the admin users workspace.
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
  auth_providers text[],
  activation_status text,
  last_sign_in_at timestamptz,
  display_name text,
  first_name text,
  last_name text,
  username text,
  username_display text,
  username_changed_at timestamptz,
  gender text,
  country text,
  city text,
  preferred_language text,
  account_status text,
  disabled_at timestamptz,
  disabled_by uuid,
  onboarding_completed_at timestamptz,
  active_trips integer,
  total_trips integer,
  provider_subscription_id text,
  provider_price_id text,
  provider_status text,
  subscription_status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  grace_ends_at timestamptz,
  subscription_currency text,
  subscription_amount integer,
  subscription_last_event_id text,
  subscription_last_event_type text,
  subscription_last_event_at timestamptz,
  system_role text,
  tier_key text,
  entitlements_override jsonb,
  terms_accepted_version text,
  terms_accepted_at timestamptz,
  terms_accepted_locale text,
  terms_acceptance_source text,
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
        else coalesce(
          (
            select provider_name
              from unnest(coalesce(identity_providers.providers, array[]::text[])) provider_name
             where provider_name <> 'email'
             order by provider_name
             limit 1
          ),
          case when u.email is not null then 'email' else 'unknown' end
        )
      end
    )::text,
    (
      case
        when u.id is null then array[]::text[]
        when coalesce(array_length(identity_providers.providers, 1), 0) > 0 then identity_providers.providers
        when u.email is not null then array['email']::text[]
        else array[]::text[]
      end
    )::text[],
    (
      case
        when u.id is null then 'pending'
        when coalesce((u.raw_app_meta_data ->> 'provider') = 'anonymous', false) then 'anonymous'
        when u.last_sign_in_at is null and u.email is not null then 'invited'
        when u.last_sign_in_at is null then 'pending'
        else 'activated'
      end
    )::text,
    u.last_sign_in_at::timestamptz,
    p.display_name,
    p.first_name,
    p.last_name,
    p.username,
    p.username_display,
    p.username_changed_at,
    p.gender,
    p.country,
    p.city,
    p.preferred_language,
    p.account_status,
    p.disabled_at,
    p.disabled_by,
    p.onboarding_completed_at,
    coalesce(trip_counts.active_trips, 0)::integer,
    coalesce(trip_counts.total_trips, 0)::integer,
    s.provider_subscription_id,
    s.provider_price_id,
    s.provider_status,
    s.status as subscription_status,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at,
    s.canceled_at,
    s.grace_ends_at,
    s.currency as subscription_currency,
    s.amount as subscription_amount,
    s.last_event_id as subscription_last_event_id,
    s.last_event_type as subscription_last_event_type,
    s.last_event_at as subscription_last_event_at,
    p.system_role,
    p.tier_key,
    p.entitlements_override,
    p.terms_accepted_version,
    p.terms_accepted_at,
    p.terms_accepted_locale,
    p.terms_acceptance_source,
    p.created_at,
    p.updated_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join lateral (
    select
      array_agg(distinct provider_name order by provider_name) filter (where provider_name is not null) as providers
    from (
      select nullif(lower(i.provider), '') as provider_name
      from auth.identities i
      where i.user_id = u.id
    ) provider_rows
  ) identity_providers on true
  left join lateral (
    select
      count(*)::integer as total_trips,
      count(*) filter (where coalesce(t.status, 'active') = 'active')::integer as active_trips
    from public.trips t
    where t.owner_id = p.id
  ) trip_counts on true
  left join public.subscriptions s on s.user_id = p.id
  where (
    p_search is null
    or p_search = ''
    or coalesce(u.email, '') ilike ('%' || p_search || '%')
    or coalesce(p.first_name, '') ilike ('%' || p_search || '%')
    or coalesce(p.last_name, '') ilike ('%' || p_search || '%')
    or coalesce(p.username, '') ilike ('%' || p_search || '%')
    or coalesce(s.provider_subscription_id, '') ilike ('%' || p_search || '%')
    or coalesce(s.provider_status, '') ilike ('%' || p_search || '%')
    or coalesce(s.status, '') ilike ('%' || p_search || '%')
    or p.id::text ilike ('%' || p_search || '%')
  )
  order by p.created_at desc
  limit greatest(coalesce(p_limit, 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

drop function if exists public.admin_get_user_profile(uuid);

drop function if exists public.admin_get_user_profile(uuid);
create or replace function public.admin_get_user_profile(
  p_user_id uuid
)
returns table(
  user_id uuid,
  email text,
  is_anonymous boolean,
  auth_provider text,
  auth_providers text[],
  activation_status text,
  last_sign_in_at timestamptz,
  display_name text,
  first_name text,
  last_name text,
  username text,
  username_display text,
  username_changed_at timestamptz,
  gender text,
  country text,
  city text,
  preferred_language text,
  account_status text,
  disabled_at timestamptz,
  disabled_by uuid,
  onboarding_completed_at timestamptz,
  active_trips integer,
  total_trips integer,
  provider_subscription_id text,
  provider_price_id text,
  provider_status text,
  subscription_status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  grace_ends_at timestamptz,
  subscription_currency text,
  subscription_amount integer,
  subscription_last_event_id text,
  subscription_last_event_type text,
  subscription_last_event_at timestamptz,
  system_role text,
  tier_key text,
  entitlements_override jsonb,
  terms_accepted_version text,
  terms_accepted_at timestamptz,
  terms_accepted_locale text,
  terms_acceptance_source text,
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
        else coalesce(
          (
            select provider_name
              from unnest(coalesce(identity_providers.providers, array[]::text[])) provider_name
             where provider_name <> 'email'
             order by provider_name
             limit 1
          ),
          case when u.email is not null then 'email' else 'unknown' end
        )
      end
    )::text,
    (
      case
        when u.id is null then array[]::text[]
        when coalesce(array_length(identity_providers.providers, 1), 0) > 0 then identity_providers.providers
        when u.email is not null then array['email']::text[]
        else array[]::text[]
      end
    )::text[],
    (
      case
        when u.id is null then 'pending'
        when coalesce((u.raw_app_meta_data ->> 'provider') = 'anonymous', false) then 'anonymous'
        when u.last_sign_in_at is null and u.email is not null then 'invited'
        when u.last_sign_in_at is null then 'pending'
        else 'activated'
      end
    )::text,
    u.last_sign_in_at::timestamptz,
    p.display_name,
    p.first_name,
    p.last_name,
    p.username,
    p.username_display,
    p.username_changed_at,
    p.gender,
    p.country,
    p.city,
    p.preferred_language,
    p.account_status,
    p.disabled_at,
    p.disabled_by,
    p.onboarding_completed_at,
    coalesce(trip_counts.active_trips, 0)::integer,
    coalesce(trip_counts.total_trips, 0)::integer,
    s.provider_subscription_id,
    s.provider_price_id,
    s.provider_status,
    s.status as subscription_status,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at,
    s.canceled_at,
    s.grace_ends_at,
    s.currency as subscription_currency,
    s.amount as subscription_amount,
    s.last_event_id as subscription_last_event_id,
    s.last_event_type as subscription_last_event_type,
    s.last_event_at as subscription_last_event_at,
    p.system_role,
    p.tier_key,
    p.entitlements_override,
    p.terms_accepted_version,
    p.terms_accepted_at,
    p.terms_accepted_locale,
    p.terms_acceptance_source,
    p.created_at,
    p.updated_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join lateral (
    select
      array_agg(distinct provider_name order by provider_name) filter (where provider_name is not null) as providers
    from (
      select nullif(lower(i.provider), '') as provider_name
      from auth.identities i
      where i.user_id = u.id
    ) provider_rows
  ) identity_providers on true
  left join lateral (
    select
      count(*)::integer as total_trips,
      count(*) filter (where coalesce(t.status, 'active') = 'active')::integer as active_trips
    from public.trips t
    where t.owner_id = p.id
  ) trip_counts on true
  left join public.subscriptions s on s.user_id = p.id
  where p.id = p_user_id
  limit 1;
end;
$$;

create or replace function public.profile_normalize_country_code(p_country text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when nullif(btrim(coalesce(p_country, '')), '') is null then null
    when btrim(p_country) ~ '^[A-Za-z]{2}$' then upper(btrim(p_country))
    else null
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
  p_tier_key text default null,
  p_bypass_username_cooldown boolean default false
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
  v_country_raw text;
  v_country_normalized text;
begin
  if not public.has_admin_permission('users.write') then
    raise exception 'Not allowed';
  end if;

  perform set_config(
    'app.username_cooldown_bypass',
    case when coalesce(p_bypass_username_cooldown, false) then 'true' else 'false' end,
    true
  );
  perform set_config('app.username_reserved_bypass', 'true', true);

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

  v_country_raw := nullif(btrim(coalesce(p_country, '')), '');
  if v_country_raw is not null then
    v_country_normalized := public.profile_normalize_country_code(v_country_raw);
    if v_country_normalized is null then
      raise exception 'Country/Region must be a valid ISO 3166-1 alpha-2 country code';
    end if;
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
         username_display = case
           when p_username is null then p.username_display
           else nullif(regexp_replace(btrim(coalesce(p_username, '')), '^@+', ''), '')
         end,
         gender = coalesce(p_gender, p.gender),
         country = coalesce(v_country_normalized, p.country),
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

drop function if exists public.admin_reset_user_username_cooldown(uuid, text);
create or replace function public.admin_reset_user_username_cooldown(
  p_user_id uuid,
  p_reason text default null
)
returns table(
  user_id uuid,
  username text,
  username_display text,
  username_changed_at timestamptz,
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
  v_reason text;
  v_before_username_changed_at timestamptz;
begin
  if not public.has_admin_permission('users.write') then
    raise exception 'Not allowed';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');

  select
    to_jsonb(p),
    p.username_changed_at
    into
      v_before,
      v_before_username_changed_at
    from public.profiles p
   where p.id = p_user_id;

  if v_before is null then
    raise exception 'User profile not found';
  end if;

  if v_before_username_changed_at is null then
    raise exception 'Username cooldown is not active for this user';
  end if;

  update public.profiles p
     set username_changed_at = null,
         updated_at = now()
   where p.id = p_user_id;

  select to_jsonb(p)
    into v_after
    from public.profiles p
   where p.id = p_user_id;

  perform public.admin_write_audit(
    'admin.user.reset_username_cooldown',
    'user',
    p_user_id::text,
    v_before,
    v_after,
    jsonb_build_object(
      'reason', v_reason,
      'updated_by', auth.uid()
    )
  );

  insert into public.profile_user_events (
    owner_id,
    action,
    source,
    before_data,
    after_data,
    metadata
  )
  values (
    p_user_id,
    'profile.username_cooldown.reset_by_admin',
    'admin.user.reset_username_cooldown',
    jsonb_build_object(
      'username_changed_at', v_before_username_changed_at
    ),
    jsonb_build_object(
      'username_changed_at', null
    ),
    jsonb_build_object(
      'reason', v_reason,
      'updated_by', auth.uid()
    )
  );

  return query
  select
    p.id,
    p.username,
    p.username_display,
    p.username_changed_at,
    p.updated_at
  from public.profiles p
  where p.id = p_user_id;
end;
$$;

drop function if exists public.admin_reset_user_terms_acceptance(uuid, text);
create or replace function public.admin_reset_user_terms_acceptance(
  p_user_id uuid,
  p_reason text default null
)
returns table(
  user_id uuid,
  terms_accepted_version text,
  terms_accepted_at timestamptz,
  terms_accepted_locale text,
  terms_acceptance_source text,
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
  v_reason text;
  v_before_terms_version text;
  v_before_terms_accepted_at timestamptz;
  v_before_terms_locale text;
  v_before_terms_source text;
begin
  if not public.has_admin_permission('users.write') then
    raise exception 'Not allowed';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');

  select to_jsonb(p),
         p.terms_accepted_version,
         p.terms_accepted_at,
         p.terms_accepted_locale,
         p.terms_acceptance_source
    into v_before,
         v_before_terms_version,
         v_before_terms_accepted_at,
         v_before_terms_locale,
         v_before_terms_source
    from public.profiles p
   where p.id = p_user_id;

  if v_before is null then
    raise exception 'User profile not found';
  end if;

  if v_before_terms_version is null
    and v_before_terms_accepted_at is null
    and v_before_terms_locale is null
    and v_before_terms_source is null then
    raise exception 'Terms acceptance is already empty for this user';
  end if;

  update public.profiles p
     set terms_accepted_version = null,
         terms_accepted_at = null,
         terms_accepted_locale = null,
         terms_acceptance_source = null,
         updated_at = now()
   where p.id = p_user_id;

  select to_jsonb(p)
    into v_after
    from public.profiles p
   where p.id = p_user_id;

  perform public.admin_write_audit(
    'admin.user.reset_terms_acceptance',
    'user',
    p_user_id::text,
    v_before,
    v_after,
    jsonb_build_object(
      'reason', v_reason,
      'updated_by', auth.uid()
    )
  );

  insert into public.profile_user_events (
    owner_id,
    action,
    source,
    before_data,
    after_data,
    metadata
  )
  values (
    p_user_id,
    'legal.terms.reset_by_admin',
    'admin.user.reset_terms_acceptance',
    jsonb_build_object(
      'terms_accepted_version', v_before_terms_version,
      'terms_accepted_at', v_before_terms_accepted_at,
      'terms_accepted_locale', v_before_terms_locale,
      'terms_acceptance_source', v_before_terms_source
    ),
    jsonb_build_object(
      'terms_accepted_version', null,
      'terms_accepted_at', null,
      'terms_accepted_locale', null,
      'terms_acceptance_source', null
    ),
    jsonb_build_object(
      'reason', v_reason,
      'updated_by', auth.uid()
    )
  );

  return query
  select
    p.id,
    p.terms_accepted_version,
    p.terms_accepted_at,
    p.terms_accepted_locale,
    p.terms_acceptance_source,
    p.updated_at
  from public.profiles p
  where p.id = p_user_id;
end;
$$;

drop function if exists public.admin_list_trips(integer, integer, text, uuid, text);

create or replace function public.admin_list_trips(
  p_limit integer default 200,
  p_offset integer default 0,
  p_search text default null,
  p_owner_id uuid default null,
  p_status text default null,
  p_generation_state text default null
)
returns table(
  trip_id text,
  owner_id uuid,
  owner_email text,
  title text,
  status text,
  generation_state text,
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
  with base as (
    select
      t.id as trip_id,
      t.owner_id,
      u.email::text as owner_email,
      t.title,
      coalesce(t.status, 'active') as status,
      case
        when coalesce(t.data #>> '{aiMeta,generation,state}', '') in ('queued', 'running', 'succeeded', 'failed')
          then t.data #>> '{aiMeta,generation,state}'
        when exists (
          select 1
            from jsonb_array_elements(coalesce(t.data -> 'items', '[]'::jsonb)) as item
           where lower(coalesce(item ->> 'loading', 'false')) = 'true'
        )
          then 'running'
        else 'succeeded'
      end as generation_state,
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
  )
  select
    base.trip_id,
    base.owner_id,
    base.owner_email,
    base.title,
    base.status,
    base.generation_state,
    base.trip_expires_at,
    base.archived_at,
    base.source_kind,
    base.created_at,
    base.updated_at
  from base
  where (
    p_generation_state is null
    or p_generation_state = ''
    or base.generation_state = p_generation_state
  )
  order by base.updated_at desc
  limit greatest(coalesce(p_limit, 200), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

drop function if exists public.admin_list_user_trips(uuid, integer, integer, text);

create or replace function public.admin_list_user_trips(
  p_user_id uuid,
  p_limit integer default 200,
  p_offset integer default 0,
  p_status text default null,
  p_generation_state text default null
)
returns table(
  trip_id text,
  owner_id uuid,
  owner_email text,
  title text,
  status text,
  generation_state text,
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
  with base as (
    select
      t.id as trip_id,
      t.owner_id,
      u.email::text as owner_email,
      t.title,
      coalesce(t.status, 'active') as status,
      case
        when coalesce(t.data #>> '{aiMeta,generation,state}', '') in ('queued', 'running', 'succeeded', 'failed')
          then t.data #>> '{aiMeta,generation,state}'
        when exists (
          select 1
            from jsonb_array_elements(coalesce(t.data -> 'items', '[]'::jsonb)) as item
           where lower(coalesce(item ->> 'loading', 'false')) = 'true'
        )
          then 'running'
        else 'succeeded'
      end as generation_state,
      t.trip_expires_at,
      t.archived_at,
      t.source_kind,
      t.created_at,
      t.updated_at
    from public.trips t
    left join auth.users u on u.id = t.owner_id
    where t.owner_id = p_user_id
      and (p_status is null or p_status = '' or coalesce(t.status, 'active') = p_status)
  )
  select
    base.trip_id,
    base.owner_id,
    base.owner_email,
    base.title,
    base.status,
    base.generation_state,
    base.trip_expires_at,
    base.archived_at,
    base.source_kind,
    base.created_at,
    base.updated_at
  from base
  where (
    p_generation_state is null
    or p_generation_state = ''
    or base.generation_state = p_generation_state
  )
  order by base.updated_at desc
  limit greatest(coalesce(p_limit, 200), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_list_billing_subscriptions(
  p_limit integer default 250,
  p_offset integer default 0,
  p_search text default null
)
returns table(
  user_id uuid,
  email text,
  tier_key text,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  provider_price_id text,
  provider_status text,
  subscription_status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  grace_ends_at timestamptz,
  currency text,
  amount integer,
  last_event_id text,
  last_event_type text,
  last_event_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
begin
  if not public.has_admin_permission('billing.read') then
    raise exception 'Not allowed';
  end if;

  return query
  select
    s.user_id,
    u.email::text,
    p.tier_key,
    s.provider,
    s.provider_customer_id,
    s.provider_subscription_id,
    s.provider_price_id,
    s.provider_status,
    s.status as subscription_status,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at,
    s.canceled_at,
    s.grace_ends_at,
    s.currency,
    s.amount,
    s.last_event_id,
    s.last_event_type,
    s.last_event_at,
    s.created_at,
    s.updated_at
  from public.subscriptions s
  left join public.profiles p on p.id = s.user_id
  left join auth.users u on u.id = s.user_id
  where (
    p_search is null
    or p_search = ''
    or s.user_id::text ilike ('%' || p_search || '%')
    or coalesce(u.email, '') ilike ('%' || p_search || '%')
    or coalesce(s.provider_subscription_id, '') ilike ('%' || p_search || '%')
    or coalesce(s.provider_customer_id, '') ilike ('%' || p_search || '%')
    or coalesce(s.provider_status, '') ilike ('%' || p_search || '%')
    or coalesce(s.last_event_type, '') ilike ('%' || p_search || '%')
    or coalesce(p.tier_key, '') ilike ('%' || p_search || '%')
  )
  order by coalesce(s.updated_at, s.created_at) desc
  limit greatest(coalesce(p_limit, 250), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;


-- Billing admin KPI and chart aggregates.
create or replace function public.admin_get_billing_dashboard()
returns table(
  active_subscriptions integer,
  scheduled_cancellations integer,
  grace_subscriptions integer,
  failed_webhook_events integer,
  current_mrr_by_currency jsonb,
  current_mrr_by_tier jsonb,
  subscription_mix jsonb,
  status_mix jsonb,
  at_risk_revenue jsonb
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
begin
  if not public.has_admin_permission('billing.read') then
    raise exception 'Not allowed';
  end if;

  return query
  with normalized_subscriptions as (
    select
      s.user_id,
      coalesce(p.tier_key, 'tier_free') as tier_key,
      lower(coalesce(nullif(s.provider_status, ''), nullif(s.status, ''), 'unknown')) as raw_status,
      s.cancel_at,
      s.canceled_at,
      s.grace_ends_at,
      upper(coalesce(nullif(s.currency, ''), 'USD')) as currency,
      coalesce(s.amount, 0) as amount
    from public.subscriptions s
    left join public.profiles p on p.id = s.user_id
  ),
  classified_subscriptions as (
    select
      ns.*,
      (
        ns.raw_status = 'canceled'
        and ns.grace_ends_at is not null
        and ns.grace_ends_at > now()
      ) as grace_active,
      (
        ns.cancel_at is not null
        and ns.cancel_at > now()
        and ns.raw_status in ('active', 'trialing', 'past_due')
      ) as scheduled_cancel,
      case
        when ns.raw_status = 'canceled'
          and ns.grace_ends_at is not null
          and ns.grace_ends_at > now()
          then 'grace'
        else ns.raw_status
      end as dashboard_status
    from normalized_subscriptions ns
  ),
  current_mrr as (
    select
      cs.currency,
      sum(cs.amount)::bigint as amount,
      count(*)::integer as subscriptions
    from classified_subscriptions cs
    where cs.raw_status in ('active', 'trialing', 'past_due')
    group by cs.currency
  ),
  mrr_by_tier as (
    select
      cs.tier_key,
      cs.currency,
      sum(cs.amount)::bigint as amount,
      count(*)::integer as subscriptions
    from classified_subscriptions cs
    where cs.raw_status in ('active', 'trialing', 'past_due')
    group by cs.tier_key, cs.currency
  ),
  tier_mix as (
    select
      cs.tier_key,
      count(*)::integer as count
    from classified_subscriptions cs
    group by cs.tier_key
  ),
  status_mix as (
    select
      cs.dashboard_status as status,
      count(*)::integer as count
    from classified_subscriptions cs
    group by cs.dashboard_status
  ),
  at_risk_revenue as (
    select
      cs.dashboard_status as status,
      cs.currency,
      sum(cs.amount)::bigint as amount,
      count(*)::integer as subscriptions
    from classified_subscriptions cs
    where cs.dashboard_status in ('past_due', 'paused', 'grace', 'canceled')
    group by cs.dashboard_status, cs.currency
  ),
  failed_webhook_count as (
    select count(*)::integer as count
    from public.billing_webhook_events e
    where lower(coalesce(e.status, '')) = 'failed'
  )
  select
    count(*) filter (where cs.raw_status in ('active', 'trialing', 'past_due'))::integer as active_subscriptions,
    count(*) filter (where cs.scheduled_cancel)::integer as scheduled_cancellations,
    count(*) filter (where cs.grace_active)::integer as grace_subscriptions,
    coalesce((select count from failed_webhook_count), 0)::integer as failed_webhook_events,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'currency', row.currency,
          'amount', row.amount,
          'subscriptions', row.subscriptions
        )
        order by row.currency
      )
      from current_mrr row
    ), '[]'::jsonb) as current_mrr_by_currency,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'tier_key', row.tier_key,
          'currency', row.currency,
          'amount', row.amount,
          'subscriptions', row.subscriptions
        )
        order by row.tier_key, row.currency
      )
      from mrr_by_tier row
    ), '[]'::jsonb) as current_mrr_by_tier,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'tier_key', row.tier_key,
          'count', row.count
        )
        order by row.tier_key
      )
      from tier_mix row
    ), '[]'::jsonb) as subscription_mix,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'status', row.status,
          'count', row.count
        )
        order by row.status
      )
      from status_mix row
    ), '[]'::jsonb) as status_mix,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'status', row.status,
          'currency', row.currency,
          'amount', row.amount,
          'subscriptions', row.subscriptions
        )
        order by row.status, row.currency
      )
      from at_risk_revenue row
    ), '[]'::jsonb) as at_risk_revenue
  from classified_subscriptions cs;
end;
$$;

create or replace function public.admin_list_billing_webhook_events(
  p_limit integer default 250,
  p_offset integer default 0,
  p_search text default null
)
returns table(
  event_id text,
  provider text,
  event_type text,
  occurred_at timestamptz,
  user_id uuid,
  user_email text,
  status text,
  error_message text,
  payload jsonb,
  processed_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
begin
  if not public.has_admin_permission('billing.read') then
    raise exception 'Not allowed';
  end if;

  return query
  select
    e.event_id,
    e.provider,
    e.event_type,
    e.occurred_at,
    e.user_id,
    u.email::text as user_email,
    e.status,
    e.error_message,
    e.payload,
    e.processed_at,
    e.created_at
  from public.billing_webhook_events e
  left join auth.users u on u.id = e.user_id
  where (
    p_search is null
    or p_search = ''
    or e.event_id ilike ('%' || p_search || '%')
    or coalesce(u.email, '') ilike ('%' || p_search || '%')
    or coalesce(e.user_id::text, '') ilike ('%' || p_search || '%')
    or coalesce(e.event_type, '') ilike ('%' || p_search || '%')
    or coalesce(e.status, '') ilike ('%' || p_search || '%')
    or coalesce(e.error_message, '') ilike ('%' || p_search || '%')
    or coalesce(e.payload::text, '') ilike ('%' || p_search || '%')
  )
  order by e.occurred_at desc, e.created_at desc
  limit greatest(coalesce(p_limit, 250), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

drop function if exists public.admin_get_trip_for_view(text);
create function public.admin_get_trip_for_view(
  p_trip_id text
)
returns table(
  trip_id text,
  owner_id uuid,
  owner_email text,
  data jsonb,
  view_settings jsonb,
  status text,
  trip_expires_at timestamptz,
  source_kind text,
  source_template_id text,
  updated_at timestamptz,
  can_write boolean
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
    t.data,
    t.view_settings,
    coalesce(t.status, 'active'),
    t.trip_expires_at,
    t.source_kind,
    t.source_template_id,
    t.updated_at,
    public.has_admin_permission('trips.write')
  from public.trips t
  left join auth.users u on u.id = t.owner_id
  where t.id = p_trip_id
  limit 1;
end;
$$;

drop function if exists public.admin_override_trip_commit(text, jsonb, jsonb, text, date, boolean, text);
drop function if exists public.admin_override_trip_commit(text, jsonb, jsonb, text, date, boolean, text, jsonb);
create or replace function public.admin_override_trip_commit(
  p_trip_id text,
  p_data jsonb,
  p_view jsonb default null,
  p_title text default null,
  p_start_date date default null,
  p_is_favorite boolean default null,
  p_label text default null,
  p_metadata jsonb default null
)
returns table(
  trip_id text,
  version_id uuid,
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
  v_status text;
  v_trip_expires_at timestamptz;
  v_updated_at timestamptz;
  v_version_id uuid;
  v_effective_label text;
  v_metadata jsonb;
begin
  if not public.has_admin_permission('trips.write') then
    raise exception 'Not allowed';
  end if;

  select
    to_jsonb(t),
    coalesce(t.status, 'active'),
    t.trip_expires_at
    into v_before, v_status, v_trip_expires_at
  from public.trips t
  where t.id = p_trip_id;

  if v_before is null then
    raise exception 'Trip not found';
  end if;

  if v_status = 'archived' then
    raise exception 'Trip is archived and read-only in admin override mode';
  end if;

  if v_status = 'expired' then
    raise exception 'Trip is expired and read-only in admin override mode';
  end if;

  if v_trip_expires_at is not null and v_trip_expires_at <= now() then
    raise exception 'Trip has expired and is read-only in admin override mode';
  end if;

  update public.trips t
     set data = coalesce(p_data, t.data),
         view_settings = coalesce(p_view, t.view_settings),
         title = coalesce(p_title, t.title),
         start_date = coalesce(p_start_date, t.start_date),
         is_favorite = coalesce(p_is_favorite, t.is_favorite),
         updated_at = now()
   where t.id = p_trip_id
   returning t.updated_at into v_updated_at;

  select to_jsonb(t)
    into v_after
  from public.trips t
  where t.id = p_trip_id;

  v_effective_label := coalesce(nullif(btrim(p_label), ''), 'Admin override commit');

  insert into public.trip_versions (
    trip_id,
    data,
    view_settings,
    label,
    created_by
  )
  values (
    p_trip_id,
    coalesce(p_data, v_before -> 'data'),
    coalesce(p_view, v_before -> 'view_settings'),
    v_effective_label,
    auth.uid()
  )
  returning id into v_version_id;

  v_metadata := jsonb_build_object(
    'version_id', v_version_id,
    'label', v_effective_label
  );
  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object' then
    v_metadata := v_metadata || coalesce(p_metadata, '{}'::jsonb);
  end if;

  perform public.admin_write_audit(
    'admin.trip.override_commit',
    'trip',
    p_trip_id,
    v_before,
    v_after,
    v_metadata
  );

  return query
  select p_trip_id, v_version_id, v_updated_at;
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

create or replace function public.admin_hard_delete_trip(
  p_trip_id text
)
returns table(
  trip_id text
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_before jsonb;
begin
  if not public.has_admin_permission('trips.write') then
    raise exception 'Not allowed';
  end if;

  select to_jsonb(t)
    into v_before
  from public.trips t
  where t.id = p_trip_id;

  if v_before is null then
    raise exception 'Trip not found';
  end if;

  delete from public.trips t
  where t.id = p_trip_id;

  perform public.admin_write_audit(
    'admin.trip.hard_delete',
    'trip',
    p_trip_id,
    v_before,
    '{}'::jsonb,
    jsonb_build_object('hard_deleted', true)
  );

  return query
  select p_trip_id;
end;
$$;


-- Include Paddle billing lifecycle events in the admin audit timeline.
create or replace function public.admin_list_audit_logs(
  p_limit integer default 200,
  p_offset integer default 0,
  p_action text default null,
  p_target_type text default null,
  p_actor_user_id uuid default null
)
returns table(
  id text,
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
  with admin_logs as (
    select
      l.id::text as id,
      l.actor_user_id,
      u.email::text as actor_email,
      l.action,
      l.target_type,
      l.target_id,
      l.before_data,
      l.after_data,
      l.metadata,
      l.created_at
    from public.admin_audit_logs l
    left join auth.users u on u.id = l.actor_user_id
  ),
  billing_logs as (
    select
      ('billing__' || e.event_id)::text as id,
      null::uuid as actor_user_id,
      'Paddle'::text as actor_email,
      ('billing.' || e.event_type)::text as action,
      'subscription'::text as target_type,
      coalesce(
        nullif(e.payload -> 'data' ->> 'subscription_id', ''),
        nullif(e.payload -> 'data' ->> 'id', ''),
        e.event_id
      ) as target_id,
      null::jsonb as before_data,
      case
        when jsonb_typeof(e.payload -> 'data') = 'object' then e.payload -> 'data'
        else e.payload
      end as after_data,
      jsonb_strip_nulls(jsonb_build_object(
        'provider', e.provider,
        'event_id', e.event_id,
        'webhook_status', e.status,
        'error_message', e.error_message,
        'user_id', e.user_id,
        'processed_at', e.processed_at
      )) as metadata,
      e.occurred_at as created_at
    from public.billing_webhook_events e
  ),
  combined_logs as (
    select * from admin_logs
    union all
    select * from billing_logs
  )
  select
    cl.id,
    cl.actor_user_id,
    cl.actor_email,
    cl.action,
    cl.target_type,
    cl.target_id,
    cl.before_data,
    cl.after_data,
    cl.metadata,
    cl.created_at
  from combined_logs cl
  where (p_action is null or p_action = '' or cl.action = p_action)
    and (p_target_type is null or p_target_type = '' or cl.target_type = p_target_type)
    and (p_actor_user_id is null or cl.actor_user_id = p_actor_user_id)
  order by cl.created_at desc
  limit greatest(coalesce(p_limit, 200), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;


grant execute on function public.get_current_user_subscription_summary() to authenticated;
grant execute on function public.admin_list_users(integer, integer, text) to authenticated;
grant execute on function public.admin_get_user_profile(uuid) to authenticated;
grant execute on function public.admin_get_billing_dashboard() to authenticated;
grant execute on function public.admin_list_audit_logs(integer, integer, text, text, uuid) to authenticated;

commit;

-- Verification:
-- select column_name
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'subscriptions'
-- order by column_name;
--
-- select column_name
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'billing_webhook_events'
-- order by column_name;
