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
