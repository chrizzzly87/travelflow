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

-- Surface billing status in the admin users workspace without waiting for the full schema merge.
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
  provider_status text,
  subscription_status text,
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
    s.provider_status,
    s.status as subscription_status,
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
  provider_status text,
  subscription_status text,
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
    s.provider_status,
    s.status as subscription_status,
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
