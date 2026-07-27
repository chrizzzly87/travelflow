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

create table if not exists public.trip_user_events (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references public.trips(id) on delete cascade,
  owner_id uuid not null references auth.users on delete cascade,
  action text not null,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.profile_user_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  action text not null,
  source text,
  before_data jsonb not null default '{}'::jsonb,
  after_data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.trip_shares (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references public.trips(id) on delete cascade,
  token text not null unique,
  mode text not null check (mode in ('view', 'edit')),
  allow_copy boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
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
  passport_sticker_positions jsonb not null default '{}'::jsonb,
  passport_sticker_selection jsonb not null default '[]'::jsonb,
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

create table if not exists public.app_runtime_settings (
  singleton boolean primary key default true,
  planner_beta_open boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users on delete set null
);

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

create table if not exists public.legal_terms_versions (
  version text primary key,
  title text not null,
  summary text,
  binding_locale text not null default 'de',
  content_de text not null default '',
  content_en text not null default '',
  last_updated date not null,
  effective_at timestamptz not null default now(),
  requires_reaccept boolean not null default true,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users on delete set null
);

create table if not exists public.legal_terms_acceptance_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  terms_version text not null references public.legal_terms_versions(version) on delete restrict,
  accepted_at timestamptz not null default now(),
  accepted_locale text,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
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
  run_comment text,
  run_comment_updated_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_benchmark_preferences (
  owner_id uuid primary key references auth.users on delete cascade default auth.uid(),
  model_targets jsonb not null default '[]'::jsonb,
  presets jsonb not null default '[]'::jsonb,
  selected_preset_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_generation_events (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('create_trip', 'benchmark')),
  request_id text not null,
  provider text not null,
  model text not null,
  provider_model text,
  status text not null check (status in ('success', 'failed')),
  latency_ms integer not null default 0,
  http_status integer,
  error_code text,
  error_message text,
  estimated_cost_usd numeric(12,6),
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  benchmark_session_id uuid references public.ai_benchmark_sessions(id) on delete set null,
  benchmark_run_id uuid references public.ai_benchmark_runs(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.async_worker_health_checks (
  id uuid primary key default gen_random_uuid(),
  check_type text not null check (check_type in ('heartbeat', 'watchdog', 'canary')),
  status text not null check (status in ('ok', 'warning', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stale_queued_count integer not null default 0,
  oldest_queued_age_ms integer,
  dispatch_attempted boolean not null default false,
  dispatch_http_status integer,
  canary_latency_ms integer,
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.app_runtime_settings add column if not exists planner_beta_open boolean;
update public.app_runtime_settings
set planner_beta_open = false
where planner_beta_open is null;
alter table public.app_runtime_settings alter column planner_beta_open set default false;
alter table public.app_runtime_settings alter column planner_beta_open set not null;
alter table public.app_runtime_settings add column if not exists updated_at timestamptz;
update public.app_runtime_settings
set updated_at = now()
where updated_at is null;
alter table public.app_runtime_settings alter column updated_at set default now();
alter table public.app_runtime_settings alter column updated_at set not null;
alter table public.app_runtime_settings
  add column if not exists updated_by uuid references auth.users on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_runtime_settings_singleton_true'
      and conrelid = 'public.app_runtime_settings'::regclass
  ) then
    alter table public.app_runtime_settings
      add constraint app_runtime_settings_singleton_true
      check (singleton);
  end if;
end
$$;

insert into public.app_runtime_settings (singleton)
values (true)
on conflict (singleton) do nothing;

-- Forward-compatible schema upgrades
alter table public.trips add column if not exists sharing_enabled boolean not null default true;
alter table public.trips add column if not exists status text not null default 'active';
alter table public.trips add column if not exists trip_expires_at timestamptz;
alter table public.trips add column if not exists archived_at timestamptz;
alter table public.trips add column if not exists source_kind text;
alter table public.trips add column if not exists source_template_id text;
alter table public.trip_shares add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists passport_sticker_positions jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists passport_sticker_selection jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists terms_accepted_version text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists terms_accepted_locale text;
alter table public.profiles add column if not exists terms_acceptance_source text;
alter table public.legal_terms_versions add column if not exists content_de text not null default '';
alter table public.legal_terms_versions add column if not exists content_en text not null default '';
alter table public.ai_benchmark_runs add column if not exists satisfaction_rating text;
alter table public.ai_benchmark_runs add column if not exists satisfaction_updated_at timestamptz;
alter table public.ai_benchmark_runs add column if not exists run_comment text;
alter table public.ai_benchmark_runs add column if not exists run_comment_updated_at timestamptz;
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

insert into public.legal_terms_versions (
  version,
  title,
  summary,
  binding_locale,
  content_de,
  content_en,
  last_updated,
  effective_at,
  requires_reaccept,
  is_current
)
values (
  '2026-03-03',
  'Terms of Service / AGB',
  'Initial production-ready Terms of Service for B2C/B2B launch with Merchant-of-Record billing model.',
  'de',
  $$## 1. Geltungsbereich
Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für sämtliche Verträge zwischen Ihnen und dem Betreiber von {appName} in der zum Zeitpunkt des Vertragsschlusses gültigen Fassung.

Abweichende Bedingungen des Nutzers werden nicht Vertragsbestandteil, es sei denn, ihrer Geltung wurde ausdrücklich schriftlich zugestimmt.

## 2. Leistungen von {appName}
{appName} bietet eine digitale Plattform zur Reiseplanung und -organisation. Der konkrete Leistungsumfang ergibt sich aus den jeweils zum Buchungs- oder Nutzungszeitpunkt angezeigten Produktinformationen.

Kostenlose und kostenpflichtige Funktionsumfänge können bestehen. Es besteht kein Anspruch auf bestimmte Funktionen, soweit diese nicht ausdrücklich als Vertragsbestandteil zugesagt wurden.

## 3. Vertragsschluss und Nutzerkonto
Der Vertrag über die Nutzung Ihres Kontos kommt mit erfolgreicher Registrierung bzw. Freischaltung zustande. Sie sind verpflichtet, bei der Registrierung zutreffende und vollständige Angaben zu machen.

Zugangsdaten sind geheim zu halten und dürfen nicht an Dritte weitergegeben werden. Sie haften für missbräuchliche Nutzung, soweit Sie diese zu vertreten haben.

## 4. Preise, Zahlung und Merchant-of-Record-Modell
Angezeigte Preise verstehen sich als Endpreise inklusive gesetzlich geschuldeter Steuern, soweit nicht anders gekennzeichnet. Bei kostenpflichtigen Plänen erfolgt die Zahlungsabwicklung über einen Merchant of Record (MoR).

Im MoR-Modell ist der jeweilige Zahlungsanbieter gegenüber dem Endkunden Verkäufer der digitalen Leistung für die Abrechnung und Rechnungsstellung. Der Nutzungsvertrag über die Plattformfunktionen besteht weiterhin mit dem Betreiber von {appName}.

Rechnungen, Zahlungsbelege, Erstattungen und steuerliche Ausweise werden nach den Bedingungen des jeweils eingesetzten Zahlungsanbieters erstellt und bereitgestellt.

## 5. Laufzeit, Kündigung und Beendigung
Soweit ein laufendes Abonnement besteht, verlängert es sich entsprechend den im Checkout angezeigten Bedingungen, sofern es nicht fristgerecht gekündigt wird.

Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Gesetzlich zwingende Rechte, insbesondere Verbraucherrechte, bleiben unberührt.

## 6. Verbraucherrechte und Widerruf
Verbrauchern stehen bei Fernabsatzverträgen gesetzliche Rechte, insbesondere Widerrufsrechte nach §§ 355 ff. BGB, zu, soweit diese nicht gesetzlich ausgeschlossen sind.

Informationen zu Voraussetzungen, Fristen, Ausnahmen und einem Muster-Widerrufsformular werden im Rahmen des Bestellprozesses auf einem dauerhaften Datenträger bereitgestellt.

## 7. Zulässige Nutzung
Die Plattform darf ausschließlich rechtmäßig genutzt werden. Unzulässig sind insbesondere missbräuchliche, betrügerische, rechtswidrige oder sicherheitsgefährdende Handlungen.

Bei Verstößen kann der Zugriff vorübergehend oder dauerhaft eingeschränkt werden, soweit dies erforderlich und verhältnismäßig ist.

## 8. Haftung
Es gilt die gesetzliche Haftung. Für leicht fahrlässige Pflichtverletzungen wird die Haftung auf vorhersehbare, vertragstypische Schäden begrenzt, soweit keine zwingenden gesetzlichen Vorschriften entgegenstehen.

Die Haftungsbeschränkungen gelten nicht bei Vorsatz, grober Fahrlässigkeit, Verletzung von Leben, Körper oder Gesundheit sowie bei zwingender Produkthaftung.

## 9. Änderungen dieser AGB
Änderungen dieser AGB werden nur unter Beachtung der gesetzlichen Vorgaben vorgenommen. Wesentliche Änderungen werden vor Inkrafttreten in geeigneter Form angekündigt.

Sofern eine erneute Zustimmung rechtlich erforderlich oder aus Compliance-Gründen vorgesehen ist, wird der weitere Zugriff auf geschützte Kontofunktionen von der Zustimmung zur jeweils aktuellen Fassung abhängig gemacht.

## 10. Anwendbares Recht und Streitbeilegung
Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts, soweit keine zwingenden Verbraucherschutzvorschriften entgegenstehen.

Informationen zur Teilnahme an Verbraucherstreitbeilegungsverfahren finden Sie im Impressum.
$$,
  $$## 1. Scope
These Terms apply to all agreements between you and the operator of {appName} at the time you enter into the contract.

## 2. Service
{appName} provides digital travel-planning functionality. Features can differ by plan and can evolve over time.

## 3. Account
You must provide accurate account data and keep credentials confidential.

## 4. Pricing, payment, and MoR model
Paid plans are processed through a Merchant of Record provider responsible for checkout and invoice issuance.

Your platform-use agreement remains with the operator of {appName}.

## 5. Term and cancellation
Subscription term, renewal, and cancellation conditions are shown during checkout. Mandatory consumer rights remain unaffected.

## 6. Consumer withdrawal rights
Consumers may have statutory withdrawal rights under German/EU distance-selling rules, including digital-content/service rules where applicable.

## 7. Acceptable use
Illegal, abusive, fraudulent, or security-threatening use is prohibited and can lead to restriction or termination.

## 8. Liability
Liability follows mandatory law. For minor negligence, liability is limited to foreseeable, typical contractual damages where legally permissible.

## 9. Terms updates
Material changes are announced before they take effect. If required, continued use of protected account features requires accepting the current version.

## 10. Governing law
German law applies, subject to mandatory consumer protections.
$$,
  date '2026-03-03',
  '2026-03-03T00:00:00Z'::timestamptz,
  true,
  true
)
on conflict (version) do update
set
  title = excluded.title,
  summary = excluded.summary,
  binding_locale = excluded.binding_locale,
  content_de = excluded.content_de,
  content_en = excluded.content_en,
  last_updated = excluded.last_updated;

do $$
begin
  if not exists (
    select 1
    from public.legal_terms_versions ltv
    where ltv.is_current = true
  ) then
    update public.legal_terms_versions ltv
       set is_current = (ltv.version = '2026-03-03');
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
create index if not exists trip_user_events_owner_created_idx on public.trip_user_events(owner_id, created_at desc);
create index if not exists trip_user_events_trip_created_idx on public.trip_user_events(trip_id, created_at desc);
create index if not exists profile_user_events_owner_created_idx on public.profile_user_events(owner_id, created_at desc);
create index if not exists profile_user_events_action_created_idx on public.profile_user_events(action, created_at desc);
create index if not exists trip_shares_trip_id_idx on public.trip_shares(trip_id);
create index if not exists trip_collaborators_user_id_idx on public.trip_collaborators(user_id);
create index if not exists ai_benchmark_sessions_owner_created_idx on public.ai_benchmark_sessions(owner_id, created_at desc);
create index if not exists ai_benchmark_runs_session_created_idx on public.ai_benchmark_runs(session_id, created_at asc);
create index if not exists ai_benchmark_runs_session_status_idx on public.ai_benchmark_runs(session_id, status);
create index if not exists ai_benchmark_runs_trip_id_idx on public.ai_benchmark_runs(trip_id);
create index if not exists ai_benchmark_preferences_updated_at_idx on public.ai_benchmark_preferences(updated_at desc);
create index if not exists ai_generation_events_created_idx on public.ai_generation_events(created_at desc);
create index if not exists ai_generation_events_source_created_idx on public.ai_generation_events(source, created_at desc);
create index if not exists ai_generation_events_provider_created_idx on public.ai_generation_events(provider, created_at desc);
create index if not exists ai_generation_events_status_created_idx on public.ai_generation_events(status, created_at desc);
create index if not exists async_worker_health_checks_started_idx on public.async_worker_health_checks(started_at desc);
create index if not exists async_worker_health_checks_type_started_idx on public.async_worker_health_checks(check_type, started_at desc);
create index if not exists async_worker_health_checks_status_started_idx on public.async_worker_health_checks(status, started_at desc);
create unique index if not exists subscriptions_provider_subscription_uidx
  on public.subscriptions(provider_subscription_id)
  where provider_subscription_id is not null;
create index if not exists subscriptions_provider_customer_idx on public.subscriptions(provider_customer_id);
create index if not exists subscriptions_last_event_at_idx on public.subscriptions(last_event_at desc);
create index if not exists billing_webhook_events_occurred_at_idx on public.billing_webhook_events(occurred_at desc);
create index if not exists billing_webhook_events_user_occurred_at_idx on public.billing_webhook_events(user_id, occurred_at desc);
create index if not exists legal_terms_versions_effective_idx on public.legal_terms_versions(effective_at desc);
create unique index if not exists legal_terms_versions_single_current_idx on public.legal_terms_versions((is_current)) where is_current;
create index if not exists legal_terms_acceptance_user_created_idx on public.legal_terms_acceptance_events(user_id, accepted_at desc);
create unique index if not exists legal_terms_acceptance_user_version_uidx on public.legal_terms_acceptance_events(user_id, terms_version);

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

drop trigger if exists set_ai_benchmark_preferences_updated_at on public.ai_benchmark_preferences;
create trigger set_ai_benchmark_preferences_updated_at
before update on public.ai_benchmark_preferences
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
alter table public.trip_user_events enable row level security;
alter table public.profile_user_events enable row level security;
alter table public.trip_shares enable row level security;
alter table public.trip_collaborators enable row level security;
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.plans enable row level security;
alter table public.app_runtime_settings enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_webhook_events enable row level security;
alter table public.legal_terms_versions enable row level security;
alter table public.legal_terms_acceptance_events enable row level security;
alter table public.ai_benchmark_sessions enable row level security;
alter table public.ai_benchmark_runs enable row level security;
alter table public.ai_benchmark_preferences enable row level security;
alter table public.ai_generation_events enable row level security;
alter table public.async_worker_health_checks enable row level security;

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

drop policy if exists "Trip user events owner read" on public.trip_user_events;
drop policy if exists "Trip user events owner insert" on public.trip_user_events;
create policy "Trip user events owner read"
on public.trip_user_events for select
using (
  owner_id = auth.uid()
  or public.is_admin(auth.uid())
);

create policy "Trip user events owner insert"
on public.trip_user_events for insert
with check (owner_id = auth.uid());

drop policy if exists "Profile user events owner read" on public.profile_user_events;
drop policy if exists "Profile user events owner insert" on public.profile_user_events;
create policy "Profile user events owner read"
on public.profile_user_events for select
using (
  owner_id = auth.uid()
  or public.is_admin(auth.uid())
);

create policy "Profile user events owner insert"
on public.profile_user_events for insert
with check (owner_id = auth.uid());

drop policy if exists "Legal terms versions public read" on public.legal_terms_versions;
create policy "Legal terms versions public read"
on public.legal_terms_versions for select
using (true);

drop policy if exists "Legal terms acceptance owner read" on public.legal_terms_acceptance_events;
create policy "Legal terms acceptance owner read"
on public.legal_terms_acceptance_events for select
using (
  user_id = auth.uid()
  or public.is_admin(auth.uid())
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

drop policy if exists "App runtime settings admin read" on public.app_runtime_settings;
create policy "App runtime settings admin read"
on public.app_runtime_settings for select
using (public.is_admin(auth.uid()));

drop policy if exists "App runtime settings admin update" on public.app_runtime_settings;
create policy "App runtime settings admin update"
on public.app_runtime_settings for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Subscriptions policies
drop policy if exists "Subscriptions are user-owned" on public.subscriptions;
create policy "Subscriptions are user-owned"
on public.subscriptions for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Billing webhook event policies
drop policy if exists "Billing webhook events are user-owned" on public.billing_webhook_events;
create policy "Billing webhook events are user-owned"
on public.billing_webhook_events for select
using (user_id = auth.uid());

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

-- AI benchmark preferences policies
drop policy if exists "AI benchmark preferences owner read" on public.ai_benchmark_preferences;
drop policy if exists "AI benchmark preferences owner insert" on public.ai_benchmark_preferences;
drop policy if exists "AI benchmark preferences owner update" on public.ai_benchmark_preferences;
drop policy if exists "AI benchmark preferences owner delete" on public.ai_benchmark_preferences;

create policy "AI benchmark preferences owner read"
on public.ai_benchmark_preferences for select
using (owner_id = auth.uid());

create policy "AI benchmark preferences owner insert"
on public.ai_benchmark_preferences for insert
with check (owner_id = auth.uid());

create policy "AI benchmark preferences owner update"
on public.ai_benchmark_preferences for update
using (owner_id = auth.uid());

create policy "AI benchmark preferences owner delete"
on public.ai_benchmark_preferences for delete
using (owner_id = auth.uid());

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
  v_view_settings jsonb;
  v_share_metadata jsonb;
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

  select t.view_settings
    into v_view_settings
    from public.trips t
   where t.id = p_trip_id
     and t.owner_id = auth.uid()
   limit 1;

  v_share_metadata := jsonb_build_object(
    'shared_view_v1',
    jsonb_build_object(
      'schema', 'shared_view_v1',
      'updated_at', now(),
      'view', coalesce(v_view_settings, '{}'::jsonb)
    )
  );

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
    update public.trip_shares
       set metadata = coalesce(metadata, '{}'::jsonb) || v_share_metadata
     where id = v_existing_share_id;
    return query select v_existing_token, p_mode, v_existing_share_id;
    return;
  end if;

  v_token := encode(gen_random_bytes(9), 'hex');

  insert into public.trip_shares (trip_id, token, mode, allow_copy, metadata, created_by)
  values (p_trip_id, v_token, p_mode, p_allow_copy, v_share_metadata, auth.uid())
  returning id into share_id;

  insert into public.trip_user_events (trip_id, owner_id, action, source, metadata)
  values (
    p_trip_id,
    auth.uid(),
    'trip.share_created',
    'trip.share',
    jsonb_build_object(
      'trip_id', p_trip_id,
      'mode', p_mode,
      'allow_copy', p_allow_copy,
      'share_id', share_id
    )
  );

  return query select v_token, p_mode, share_id;
end;
$$;

drop function if exists public.get_shared_trip(text);
create or replace function public.get_shared_trip(p_token text)
returns table(
  trip_id text,
  data jsonb,
  view_settings jsonb,
  share_view_settings jsonb,
  status text,
  trip_expires_at timestamptz,
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
    s.metadata -> 'shared_view_v1' -> 'view' as share_view_settings,
    t.status,
    t.trip_expires_at,
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
  share_view_settings jsonb,
  status text,
  trip_expires_at timestamptz,
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
  v_share_view_settings jsonb;
  v_latest_version_id uuid;
begin
  select
    s.trip_id,
    s.mode,
    s.allow_copy,
    s.metadata -> 'shared_view_v1' -> 'view',
    (
      select tv.id
      from public.trip_versions tv
      where tv.trip_id = s.trip_id
      order by tv.created_at desc
      limit 1
    )
    into v_trip_id, v_mode, v_allow_copy, v_share_view_settings, v_latest_version_id
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
    v_share_view_settings,
    t.status,
    t.trip_expires_at,
    v_mode,
    v_allow_copy,
    v.id,
    v_latest_version_id
  from public.trip_versions v
  join public.trips t on t.id = v.trip_id
  where v.id = p_version_id
    and v.trip_id = v_trip_id;

  if not found then
    raise exception 'Version not found for share token';
  end if;
end;
$$;

create or replace function public.update_trip_share_view_settings(
  p_trip_id text,
  p_view jsonb
)
returns table(updated_share_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_updated_count integer := 0;
begin
  v_owner := auth.uid();
  if v_owner is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
      from public.trips t
     where t.id = p_trip_id
       and t.owner_id = v_owner
  ) then
    raise exception 'Not allowed';
  end if;

  update public.trip_shares s
     set metadata = coalesce(s.metadata, '{}'::jsonb)
       || jsonb_build_object(
            'shared_view_v1',
            jsonb_build_object(
              'schema', 'shared_view_v1',
              'updated_at', now(),
              'view', coalesce(p_view, '{}'::jsonb)
            )
          )
   where s.trip_id = p_trip_id
     and s.revoked_at is null;

  get diagnostics v_updated_count = row_count;

  return query select v_updated_count;
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

  update public.trip_shares s
     set metadata = coalesce(s.metadata, '{}'::jsonb)
       || jsonb_build_object(
            'shared_view_v1',
            jsonb_build_object(
              'schema', 'shared_view_v1',
              'updated_at', now(),
              'view', coalesce(p_view, '{}'::jsonb)
            )
          )
   where s.trip_id = v_trip_id
     and s.revoked_at is null;

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
grant execute on function public.update_trip_share_view_settings(text, jsonb) to anon, authenticated;
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

create table if not exists public.trip_generation_attempts (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references public.trips(id) on delete cascade,
  owner_id uuid not null references auth.users on delete cascade,
  flow text not null check (flow in ('classic', 'wizard', 'surprise')),
  source text not null,
  state text not null check (state in ('queued', 'running', 'succeeded', 'failed')),
  provider text,
  model text,
  provider_model text,
  request_id text,
  failure_kind text check (failure_kind in ('timeout', 'abort', 'quality', 'provider', 'network', 'unknown')),
  error_code text,
  error_message text,
  status_code integer,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references public.trips(id) on delete cascade,
  owner_id uuid not null references auth.users on delete cascade,
  attempt_id uuid not null references public.trip_generation_attempts(id) on delete cascade,
  state text not null default 'queued'
    check (state in ('queued', 'leased', 'completed', 'failed', 'dead')),
  priority integer not null default 100,
  payload jsonb not null default '{}'::jsonb,
  run_after timestamptz not null default now(),
  lease_expires_at timestamptz,
  leased_by text,
  retry_count integer not null default 0,
  max_retries integer not null default 3,
  last_error_code text,
  last_error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.anonymous_asset_claims (
  id uuid primary key default gen_random_uuid(),
  anon_user_id uuid not null references auth.users on delete cascade,
  target_user_id uuid references auth.users on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'claimed', 'expired', 'failed', 'revoked')),
  metadata jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  failed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists auth_flow_logs_created_at_idx on public.auth_flow_logs(created_at desc);
create index if not exists auth_flow_logs_flow_attempt_idx on public.auth_flow_logs(flow_id, attempt_id);
create index if not exists trip_generation_requests_status_idx on public.trip_generation_requests(status);
create index if not exists trip_generation_requests_expires_idx on public.trip_generation_requests(expires_at);
create index if not exists trip_generation_requests_owner_idx on public.trip_generation_requests(owner_user_id, created_at desc);
create index if not exists trip_generation_requests_anon_idx on public.trip_generation_requests(requested_by_anon_id, created_at desc);
create index if not exists trip_generation_attempts_trip_started_idx on public.trip_generation_attempts(trip_id, started_at desc);
create index if not exists trip_generation_attempts_owner_started_idx on public.trip_generation_attempts(owner_id, started_at desc);
create index if not exists trip_generation_attempts_request_idx on public.trip_generation_attempts(request_id);
create index if not exists trip_generation_attempts_state_started_idx on public.trip_generation_attempts(state, started_at desc);
create unique index if not exists trip_generation_jobs_attempt_uidx on public.trip_generation_jobs(attempt_id);
do $$
begin
  if not exists (
    select 1
      from pg_constraint c
     where c.conname = 'trip_generation_jobs_attempt_key'
       and c.conrelid = 'public.trip_generation_jobs'::regclass
  ) then
    alter table public.trip_generation_jobs
      add constraint trip_generation_jobs_attempt_key
      unique using index trip_generation_jobs_attempt_uidx;
  end if;
end;
$$;
create index if not exists trip_generation_jobs_state_run_after_idx on public.trip_generation_jobs(state, run_after, priority, created_at);
create index if not exists trip_generation_jobs_owner_created_idx on public.trip_generation_jobs(owner_id, created_at desc);
create index if not exists trip_generation_jobs_trip_created_idx on public.trip_generation_jobs(trip_id, created_at desc);
create index if not exists anonymous_asset_claims_anon_idx on public.anonymous_asset_claims(anon_user_id, created_at desc);
create index if not exists anonymous_asset_claims_target_idx on public.anonymous_asset_claims(target_user_id, created_at desc);
create index if not exists anonymous_asset_claims_status_idx on public.anonymous_asset_claims(status, created_at desc);
create index if not exists anonymous_asset_claims_expires_idx on public.anonymous_asset_claims(expires_at);

drop trigger if exists set_trip_generation_requests_updated_at on public.trip_generation_requests;
create trigger set_trip_generation_requests_updated_at
before update on public.trip_generation_requests
for each row execute function public.set_updated_at();

drop trigger if exists set_trip_generation_attempts_updated_at on public.trip_generation_attempts;
create trigger set_trip_generation_attempts_updated_at
before update on public.trip_generation_attempts
for each row execute function public.set_updated_at();

drop trigger if exists set_trip_generation_jobs_updated_at on public.trip_generation_jobs;
create trigger set_trip_generation_jobs_updated_at
before update on public.trip_generation_jobs
for each row execute function public.set_updated_at();

drop trigger if exists set_anonymous_asset_claims_updated_at on public.anonymous_asset_claims;
create trigger set_anonymous_asset_claims_updated_at
before update on public.anonymous_asset_claims
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
  v_effective_tier_key text;
  v_override jsonb;
  v_plan_entitlements jsonb;
  v_provider_status text;
  v_subscription_status text;
  v_grace_ends_at timestamptz;
  v_normalized_status text;
begin
  select
    p.tier_key,
    p.entitlements_override,
    s.provider_status,
    s.status,
    s.grace_ends_at
    into v_tier_key, v_override, v_provider_status, v_subscription_status, v_grace_ends_at
    from public.profiles p
    left join public.subscriptions s on s.user_id = p.id
   where p.id = p_user_id;

  v_tier_key := coalesce(v_tier_key, 'tier_free');
  v_effective_tier_key := v_tier_key;
  v_override := coalesce(v_override, '{}'::jsonb);
  v_normalized_status := lower(coalesce(nullif(v_provider_status, ''), nullif(v_subscription_status, ''), 'none'));

  if v_normalized_status in ('paused', 'inactive') then
    v_effective_tier_key := 'tier_free';
  elsif v_normalized_status = 'canceled' and (v_grace_ends_at is null or v_grace_ends_at <= now()) then
    v_effective_tier_key := 'tier_free';
  end if;

  select pl.entitlements
    into v_plan_entitlements
    from public.plans pl
   where pl.key = v_effective_tier_key
   limit 1;

  if v_plan_entitlements is null then
    v_plan_entitlements := public.resolve_default_entitlements(v_effective_tier_key);
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
    p.terms_accepted_version,
    p.terms_accepted_at,
    p.terms_accepted_locale,
    p.terms_acceptance_source,
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
  v_request public.trip_generation_requests%rowtype;
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
     and r.expires_at > now()
   returning r.* into v_request;

  if v_request.id is null then
    select r.*
      into v_request
      from public.trip_generation_requests r
     where r.id = p_request_id
     limit 1;

    if v_request.id is null then
      raise exception 'Queued request not found.';
    end if;
    if v_request.expires_at <= now() or v_request.status = 'expired' then
      raise exception 'Queued request expired.';
    end if;
    if v_request.owner_user_id is null then
      raise exception 'Queued request is no longer claimable.';
    end if;
    if v_request.owner_user_id <> v_user_id then
      raise exception 'Queued request already claimed by another user.';
    end if;
    raise exception 'Queued request already claimed.';
  end if;

  return query
  select
    v_request.id,
    v_request.flow,
    v_request.payload,
    v_request.status,
    v_request.owner_user_id,
    v_request.expires_at;
end;
$$;

create or replace function public.trip_generation_attempt_start(
  p_trip_id text,
  p_flow text,
  p_source text,
  p_state text default 'running',
  p_provider text default null,
  p_model text default null,
  p_provider_model text default null,
  p_request_id text default null,
  p_started_at timestamptz default null,
  p_metadata jsonb default null
)
returns table(
  id uuid,
  trip_id text,
  flow text,
  source text,
  state text,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  request_id text,
  provider text,
  model text,
  provider_model text,
  status_code integer,
  failure_kind text,
  error_code text,
  error_message text,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_role text;
  v_user_id uuid;
  v_owner_id uuid;
  v_attempt public.trip_generation_attempts%rowtype;
begin
  v_role := coalesce(auth.role(), '');
  v_user_id := auth.uid();
  if v_role <> 'service_role' and v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select t.owner_id
    into v_owner_id
    from public.trips t
   where t.id = p_trip_id
   limit 1;

  if v_owner_id is null then
    raise exception 'Trip not found';
  end if;

  if v_role <> 'service_role' then
    if v_owner_id <> v_user_id and not public.is_admin(v_user_id) then
      raise exception 'Not allowed';
    end if;
  end if;

  if p_flow not in ('classic', 'wizard', 'surprise') then
    raise exception 'Invalid flow';
  end if;
  if p_state not in ('queued', 'running', 'succeeded', 'failed') then
    raise exception 'Invalid state';
  end if;

  insert into public.trip_generation_attempts (
    trip_id,
    owner_id,
    flow,
    source,
    state,
    provider,
    model,
    provider_model,
    request_id,
    started_at,
    metadata
  )
  values (
    p_trip_id,
    v_owner_id,
    p_flow,
    coalesce(nullif(btrim(coalesce(p_source, '')), ''), 'unknown'),
    p_state,
    nullif(btrim(coalesce(p_provider, '')), ''),
    nullif(btrim(coalesce(p_model, '')), ''),
    nullif(btrim(coalesce(p_provider_model, '')), ''),
    nullif(btrim(coalesce(p_request_id, '')), ''),
    coalesce(p_started_at, now()),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_attempt;

  return query
  select
    v_attempt.id,
    v_attempt.trip_id,
    v_attempt.flow,
    v_attempt.source,
    v_attempt.state,
    v_attempt.started_at,
    v_attempt.finished_at,
    v_attempt.duration_ms,
    v_attempt.request_id,
    v_attempt.provider,
    v_attempt.model,
    v_attempt.provider_model,
    v_attempt.status_code,
    v_attempt.failure_kind,
    v_attempt.error_code,
    v_attempt.error_message,
    v_attempt.metadata;
end;
$$;

create or replace function public.trip_generation_attempt_finish(
  p_attempt_id uuid,
  p_state text,
  p_provider text default null,
  p_model text default null,
  p_provider_model text default null,
  p_request_id text default null,
  p_finished_at timestamptz default null,
  p_duration_ms integer default null,
  p_status_code integer default null,
  p_failure_kind text default null,
  p_error_code text default null,
  p_error_message text default null,
  p_metadata jsonb default null
)
returns table(
  id uuid,
  trip_id text,
  flow text,
  source text,
  state text,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  request_id text,
  provider text,
  model text,
  provider_model text,
  status_code integer,
  failure_kind text,
  error_code text,
  error_message text,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_role text;
  v_user_id uuid;
  v_existing public.trip_generation_attempts%rowtype;
  v_finished_at timestamptz;
  v_duration_ms integer;
begin
  v_role := coalesce(auth.role(), '');
  v_user_id := auth.uid();
  if v_role <> 'service_role' and v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_state not in ('succeeded', 'failed') then
    raise exception 'Invalid state';
  end if;
  if p_failure_kind is not null and p_failure_kind not in ('timeout', 'abort', 'quality', 'provider', 'network', 'unknown') then
    raise exception 'Invalid failure kind';
  end if;

  select a.*
    into v_existing
    from public.trip_generation_attempts a
   where a.id = p_attempt_id
   limit 1;

  if v_existing.id is null then
    raise exception 'Attempt not found';
  end if;
  if v_role <> 'service_role' then
    if v_existing.owner_id <> v_user_id and not public.is_admin(v_user_id) then
      raise exception 'Not allowed';
    end if;
  end if;

  v_finished_at := coalesce(p_finished_at, now());
  if p_duration_ms is not null then
    v_duration_ms := greatest(p_duration_ms, 0);
  else
    v_duration_ms := greatest(
      extract(epoch from (v_finished_at - coalesce(v_existing.started_at, v_finished_at)))::integer * 1000,
      0
    );
  end if;

  update public.trip_generation_attempts a
     set state = p_state,
         provider = coalesce(nullif(btrim(coalesce(p_provider, '')), ''), a.provider),
         model = coalesce(nullif(btrim(coalesce(p_model, '')), ''), a.model),
         provider_model = coalesce(nullif(btrim(coalesce(p_provider_model, '')), ''), a.provider_model),
         request_id = coalesce(nullif(btrim(coalesce(p_request_id, '')), ''), a.request_id),
         finished_at = v_finished_at,
         duration_ms = v_duration_ms,
         status_code = coalesce(p_status_code, a.status_code),
         failure_kind = case
           when p_state = 'failed' then coalesce(p_failure_kind, a.failure_kind, 'unknown')
           else null
         end,
         error_code = case when p_state = 'failed' then coalesce(nullif(btrim(coalesce(p_error_code, '')), ''), a.error_code) else null end,
         error_message = case when p_state = 'failed' then coalesce(nullif(btrim(coalesce(p_error_message, '')), ''), a.error_message) else null end,
         metadata = coalesce(p_metadata, a.metadata),
         updated_at = now()
   where a.id = p_attempt_id
   returning * into v_existing;

  return query
  select
    v_existing.id,
    v_existing.trip_id,
    v_existing.flow,
    v_existing.source,
    v_existing.state,
    v_existing.started_at,
    v_existing.finished_at,
    v_existing.duration_ms,
    v_existing.request_id,
    v_existing.provider,
    v_existing.model,
    v_existing.provider_model,
    v_existing.status_code,
    v_existing.failure_kind,
    v_existing.error_code,
    v_existing.error_message,
    v_existing.metadata;
end;
$$;

create or replace function public.trip_generation_attempt_list_owner(
  p_trip_id text,
  p_limit integer default 20
)
returns table(
  id uuid,
  trip_id text,
  flow text,
  source text,
  state text,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  request_id text,
  provider text,
  model text,
  provider_model text,
  status_code integer,
  failure_kind text,
  error_code text,
  error_message text,
  metadata jsonb
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

  if not exists (
    select 1
      from public.trips t
     where t.id = p_trip_id
       and t.owner_id = v_user_id
  ) then
    raise exception 'Not allowed';
  end if;

  return query
  select
    a.id,
    a.trip_id,
    a.flow,
    a.source,
    a.state,
    a.started_at,
    a.finished_at,
    a.duration_ms,
    a.request_id,
    a.provider,
    a.model,
    a.provider_model,
    a.status_code,
    a.failure_kind,
    a.error_code,
    a.error_message,
    a.metadata
  from public.trip_generation_attempts a
  where a.trip_id = p_trip_id
    and a.owner_id = v_user_id
  order by a.started_at desc
  limit greatest(coalesce(p_limit, 20), 1);
end;
$$;

create or replace function public.trip_generation_attempt_list_admin(
  p_trip_id text,
  p_limit integer default 30
)
returns table(
  id uuid,
  trip_id text,
  flow text,
  source text,
  state text,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  request_id text,
  provider text,
  model text,
  provider_model text,
  status_code integer,
  failure_kind text,
  error_code text,
  error_message text,
  metadata jsonb
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

  return query
  select
    a.id,
    a.trip_id,
    a.flow,
    a.source,
    a.state,
    a.started_at,
    a.finished_at,
    a.duration_ms,
    a.request_id,
    a.provider,
    a.model,
    a.provider_model,
    a.status_code,
    a.failure_kind,
    a.error_code,
    a.error_message,
    a.metadata
  from public.trip_generation_attempts a
  where a.trip_id = p_trip_id
  order by a.started_at desc
  limit greatest(coalesce(p_limit, 30), 1);
end;
$$;

create or replace function public.trip_generation_job_enqueue(
  p_trip_id text,
  p_attempt_id uuid,
  p_payload jsonb default null,
  p_priority integer default 100,
  p_run_after timestamptz default null,
  p_max_retries integer default 3
)
returns table(
  id uuid,
  trip_id text,
  owner_id uuid,
  attempt_id uuid,
  state text,
  priority integer,
  retry_count integer,
  max_retries integer,
  run_after timestamptz,
  lease_expires_at timestamptz,
  leased_by text,
  payload jsonb,
  last_error_code text,
  last_error_message text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user_id uuid;
  v_owner_id uuid;
  v_attempt_owner_id uuid;
  v_attempt_trip_id text;
  v_job public.trip_generation_jobs%rowtype;
begin
  v_user_id := auth.uid();
  if coalesce(auth.role(), '') <> 'service_role' then
    if v_user_id is null then
      raise exception 'Not authenticated';
    end if;
  end if;

  select t.owner_id
    into v_owner_id
    from public.trips t
   where t.id = p_trip_id
   limit 1;

  if v_owner_id is null then
    raise exception 'Trip not found';
  end if;

  select a.owner_id, a.trip_id
    into v_attempt_owner_id, v_attempt_trip_id
    from public.trip_generation_attempts a
   where a.id = p_attempt_id
   limit 1;

  if v_attempt_owner_id is null then
    raise exception 'Attempt not found';
  end if;
  if v_attempt_trip_id <> p_trip_id then
    raise exception 'Attempt does not belong to trip';
  end if;
  if v_attempt_owner_id <> v_owner_id then
    raise exception 'Attempt owner mismatch';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' then
    if v_owner_id <> v_user_id and not public.is_admin(v_user_id) then
      raise exception 'Not allowed';
    end if;
  end if;

  insert into public.trip_generation_jobs (
    trip_id,
    owner_id,
    attempt_id,
    state,
    priority,
    payload,
    run_after,
    retry_count,
    max_retries
  )
  values (
    p_trip_id,
    v_owner_id,
    p_attempt_id,
    'queued',
    greatest(coalesce(p_priority, 100), 0),
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_run_after, now()),
    0,
    greatest(coalesce(p_max_retries, 3), 0)
  )
  on conflict on constraint trip_generation_jobs_attempt_key
  do update
     set state = case
       when public.trip_generation_jobs.state in ('completed', 'failed', 'dead')
         then public.trip_generation_jobs.state
       else 'queued'
     end,
         priority = excluded.priority,
         payload = excluded.payload,
         run_after = excluded.run_after,
         max_retries = excluded.max_retries,
         lease_expires_at = case
           when public.trip_generation_jobs.state in ('completed', 'failed', 'dead')
             then public.trip_generation_jobs.lease_expires_at
           else null
         end,
         leased_by = case
           when public.trip_generation_jobs.state in ('completed', 'failed', 'dead')
             then public.trip_generation_jobs.leased_by
           else null
         end,
         last_error_code = case
           when public.trip_generation_jobs.state in ('completed', 'failed', 'dead')
             then public.trip_generation_jobs.last_error_code
           else null
         end,
         last_error_message = case
           when public.trip_generation_jobs.state in ('completed', 'failed', 'dead')
             then public.trip_generation_jobs.last_error_message
           else null
         end,
         updated_at = now()
  returning * into v_job;

  return query
  select
    v_job.id,
    v_job.trip_id,
    v_job.owner_id,
    v_job.attempt_id,
    v_job.state,
    v_job.priority,
    v_job.retry_count,
    v_job.max_retries,
    v_job.run_after,
    v_job.lease_expires_at,
    v_job.leased_by,
    v_job.payload,
    v_job.last_error_code,
    v_job.last_error_message,
    v_job.created_at,
    v_job.updated_at;
end;
$$;

create or replace function public.trip_generation_job_claim(
  p_worker_id text default null,
  p_limit integer default 1,
  p_lease_seconds integer default 120
)
returns table(
  id uuid,
  trip_id text,
  owner_id uuid,
  attempt_id uuid,
  state text,
  priority integer,
  retry_count integer,
  max_retries integer,
  run_after timestamptz,
  lease_expires_at timestamptz,
  leased_by text,
  payload jsonb,
  last_error_code text,
  last_error_message text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_worker_id text;
  v_limit integer;
  v_lease_seconds integer;
  v_uid uuid;
begin
  v_uid := auth.uid();
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin(v_uid) then
    raise exception 'Not allowed';
  end if;

  v_worker_id := coalesce(nullif(btrim(coalesce(p_worker_id, '')), ''), concat('worker:', coalesce(v_uid::text, 'service-role')));
  v_limit := greatest(least(coalesce(p_limit, 1), 25), 1);
  v_lease_seconds := greatest(least(coalesce(p_lease_seconds, 120), 600), 30);

  return query
  with picked as (
    select j.id
      from public.trip_generation_jobs j
     where (j.state = 'queued' or (j.state = 'leased' and j.lease_expires_at is not null and j.lease_expires_at <= now()))
       and j.run_after <= now()
       and (j.lease_expires_at is null or j.lease_expires_at <= now())
     order by j.priority asc, j.run_after asc, j.created_at desc
     limit v_limit
     for update skip locked
  )
  update public.trip_generation_jobs j
     set state = 'leased',
         lease_expires_at = now() + make_interval(secs => v_lease_seconds),
         leased_by = v_worker_id,
         started_at = coalesce(j.started_at, now()),
         updated_at = now()
    from picked
   where j.id = picked.id
  returning
    j.id,
    j.trip_id,
    j.owner_id,
    j.attempt_id,
    j.state,
    j.priority,
    j.retry_count,
    j.max_retries,
    j.run_after,
    j.lease_expires_at,
    j.leased_by,
    j.payload,
    j.last_error_code,
    j.last_error_message,
    j.created_at,
    j.updated_at;
end;
$$;

create or replace function public.trip_generation_job_heartbeat(
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 120
)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin(v_uid) then
    raise exception 'Not allowed';
  end if;

  update public.trip_generation_jobs j
     set lease_expires_at = now() + make_interval(secs => greatest(least(coalesce(p_lease_seconds, 120), 600), 30)),
         updated_at = now()
   where j.id = p_job_id
     and j.state = 'leased'
     and j.leased_by = nullif(btrim(coalesce(p_worker_id, '')), '')
     and (j.lease_expires_at is null or j.lease_expires_at > now());

  return found;
end;
$$;

create or replace function public.trip_generation_job_complete(
  p_job_id uuid,
  p_worker_id text
)
returns table(
  id uuid,
  state text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_uid uuid;
  v_worker_id text;
  v_row public.trip_generation_jobs%rowtype;
begin
  v_uid := auth.uid();
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin(v_uid) then
    raise exception 'Not allowed';
  end if;
  v_worker_id := nullif(btrim(coalesce(p_worker_id, '')), '');
  if v_worker_id is null then
    raise exception 'Worker id required';
  end if;

  update public.trip_generation_jobs j
     set state = 'completed',
         lease_expires_at = null,
         leased_by = null,
         finished_at = now(),
         updated_at = now()
   where j.id = p_job_id
     and j.state = 'leased'
     and j.leased_by = v_worker_id
     and (j.lease_expires_at is null or j.lease_expires_at > now())
   returning * into v_row;

  if v_row.id is null then
    raise exception 'Job not found or not currently leased by worker';
  end if;

  return query
  select v_row.id, v_row.state, v_row.updated_at;
end;
$$;

create or replace function public.trip_generation_job_fail(
  p_job_id uuid,
  p_worker_id text,
  p_error_code text default null,
  p_error_message text default null,
  p_retry_delay_seconds integer default 15,
  p_terminal boolean default false
)
returns table(
  id uuid,
  state text,
  retry_count integer,
  run_after timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_uid uuid;
  v_worker_id text;
  v_row public.trip_generation_jobs%rowtype;
  v_next_retry_count integer;
  v_next_state text;
  v_next_run_after timestamptz;
begin
  v_uid := auth.uid();
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin(v_uid) then
    raise exception 'Not allowed';
  end if;

  v_worker_id := nullif(btrim(coalesce(p_worker_id, '')), '');
  if v_worker_id is null then
    raise exception 'Worker id required';
  end if;

  select j.*
    into v_row
    from public.trip_generation_jobs j
   where j.id = p_job_id
     and j.state = 'leased'
     and j.leased_by = v_worker_id
     and (j.lease_expires_at is null or j.lease_expires_at > now())
   limit 1
   for update;

  if v_row.id is null then
    raise exception 'Job not found or not currently leased by worker';
  end if;

  v_next_retry_count := coalesce(v_row.retry_count, 0) + 1;
  if p_terminal then
    v_next_state := 'failed';
    v_next_run_after := v_row.run_after;
  elsif v_next_retry_count > coalesce(v_row.max_retries, 0) then
    v_next_state := 'dead';
    v_next_run_after := v_row.run_after;
  else
    v_next_state := 'queued';
    v_next_run_after := now() + make_interval(secs => greatest(coalesce(p_retry_delay_seconds, 15), 0));
  end if;

  update public.trip_generation_jobs j
     set state = v_next_state,
         retry_count = v_next_retry_count,
         run_after = v_next_run_after,
         lease_expires_at = null,
         leased_by = null,
         finished_at = case when v_next_state in ('failed', 'dead') then now() else null end,
         last_error_code = nullif(btrim(coalesce(p_error_code, '')), ''),
         last_error_message = nullif(left(coalesce(p_error_message, ''), 1200), ''),
         updated_at = now()
   where j.id = p_job_id
   returning * into v_row;

  return query
  select
    v_row.id,
    v_row.state,
    v_row.retry_count,
    v_row.run_after,
    v_row.updated_at;
end;
$$;

create or replace function public.trip_generation_job_requeue(
  p_job_id uuid,
  p_reason text default null,
  p_run_after timestamptz default null,
  p_reset_retry_count boolean default false
)
returns table(
  id uuid,
  state text,
  retry_count integer,
  run_after timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_uid uuid;
  v_user_id uuid;
  v_job public.trip_generation_jobs%rowtype;
begin
  v_uid := auth.uid();
  if coalesce(auth.role(), '') <> 'service_role' then
    if v_uid is null then
      raise exception 'Not authenticated';
    end if;
  end if;

  select j.owner_id
    into v_user_id
    from public.trip_generation_jobs j
   where j.id = p_job_id
   limit 1;

  if v_user_id is null then
    raise exception 'Job not found';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' then
    if not public.is_admin(v_uid) and v_user_id <> v_uid then
      raise exception 'Not allowed';
    end if;
  end if;

  update public.trip_generation_jobs j
     set state = 'queued',
         run_after = coalesce(p_run_after, now()),
         lease_expires_at = null,
         leased_by = null,
         finished_at = null,
         retry_count = case when coalesce(p_reset_retry_count, false) then 0 else j.retry_count end,
         last_error_code = case
           when nullif(btrim(coalesce(p_reason, '')), '') is null then j.last_error_code
           else nullif(left(btrim(p_reason), 1200), '')
         end,
         last_error_message = null,
         updated_at = now()
   where j.id = p_job_id
     and j.state in ('dead', 'failed')
   returning * into v_job;

  if v_job.id is null then
    raise exception 'Job is not requeueable';
  end if;

  return query
  select
    v_job.id,
    v_job.state,
    v_job.retry_count,
    v_job.run_after,
    v_job.updated_at;
end;
$$;

create or replace function public.create_anonymous_asset_claim(
  p_expires_minutes integer default 60
)
returns table(
  claim_id uuid,
  status text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_uid uuid;
  v_is_anonymous boolean;
  v_existing public.anonymous_asset_claims%rowtype;
  v_expires_at timestamptz;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_is_anonymous := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'provider') = 'anonymous', false);
  if not v_is_anonymous then
    raise exception 'Only anonymous sessions can create asset claims';
  end if;

  update public.anonymous_asset_claims c
     set status = 'expired',
         failed_at = coalesce(c.failed_at, now()),
         updated_at = now()
   where c.anon_user_id = v_uid
     and c.status = 'pending'
     and c.expires_at <= now();

  select c.*
    into v_existing
    from public.anonymous_asset_claims c
   where c.anon_user_id = v_uid
     and c.status = 'pending'
     and c.expires_at > now()
   order by c.created_at desc
   limit 1;

  if v_existing.id is not null then
    return query select v_existing.id, v_existing.status, v_existing.expires_at;
    return;
  end if;

  v_expires_at := now() + make_interval(mins => greatest(coalesce(p_expires_minutes, 60), 5));

  insert into public.anonymous_asset_claims (
    anon_user_id,
    status,
    expires_at
  )
  values (
    v_uid,
    'pending',
    v_expires_at
  )
  returning id into claim_id;

  return query select claim_id, 'pending'::text, v_expires_at;
end;
$$;

create or replace function public.claim_anonymous_assets(
  p_claim_id uuid
)
returns table(
  claim_id uuid,
  status text,
  target_user_id uuid,
  anon_user_id uuid,
  transferred_trips integer,
  transferred_trip_events integer,
  transferred_profile_events integer,
  transferred_trip_versions integer,
  transferred_trip_shares integer,
  transferred_collaborators integer,
  deduplicated_collaborators integer
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_uid uuid;
  v_is_anonymous boolean;
  v_claim public.anonymous_asset_claims%rowtype;
  v_transferred_trips integer := 0;
  v_transferred_trip_events integer := 0;
  v_transferred_profile_events integer := 0;
  v_transferred_trip_versions integer := 0;
  v_transferred_trip_shares integer := 0;
  v_transferred_collaborators integer := 0;
  v_deduplicated_collaborators integer := 0;
  v_result jsonb := '{}'::jsonb;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_is_anonymous := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'provider') = 'anonymous', false);
  if v_is_anonymous then
    raise exception 'Anonymous sessions cannot claim assets';
  end if;

  select c.*
    into v_claim
    from public.anonymous_asset_claims c
   where c.id = p_claim_id
   for update;

  if v_claim.id is null then
    raise exception 'Anonymous asset claim not found';
  end if;

  if v_claim.status = 'claimed' then
    if v_claim.target_user_id = v_uid then
      return query select
        v_claim.id,
        v_claim.status,
        v_claim.target_user_id,
        v_claim.anon_user_id,
        coalesce((v_claim.result ->> 'transferred_trips')::integer, 0),
        coalesce((v_claim.result ->> 'transferred_trip_events')::integer, 0),
        coalesce((v_claim.result ->> 'transferred_profile_events')::integer, 0),
        coalesce((v_claim.result ->> 'transferred_trip_versions')::integer, 0),
        coalesce((v_claim.result ->> 'transferred_trip_shares')::integer, 0),
        coalesce((v_claim.result ->> 'transferred_collaborators')::integer, 0),
        coalesce((v_claim.result ->> 'deduplicated_collaborators')::integer, 0);
      return;
    end if;
    raise exception 'Anonymous asset claim already processed';
  end if;

  if v_claim.status in ('revoked', 'failed', 'expired') then
    raise exception 'Anonymous asset claim is no longer active';
  end if;

  if v_claim.expires_at <= now() then
    update public.anonymous_asset_claims c
       set status = 'expired',
           failed_at = coalesce(c.failed_at, now()),
           updated_at = now()
     where c.id = v_claim.id;
    raise exception 'Anonymous asset claim expired';
  end if;

  if v_claim.anon_user_id = v_uid then
    raise exception 'Invalid claim target';
  end if;

  update public.trips t
     set owner_id = v_uid,
         updated_at = now()
   where t.owner_id = v_claim.anon_user_id;
  get diagnostics v_transferred_trips = row_count;

  update public.trip_user_events e
     set owner_id = v_uid
   where e.owner_id = v_claim.anon_user_id;
  get diagnostics v_transferred_trip_events = row_count;

  update public.profile_user_events e
     set owner_id = v_uid
   where e.owner_id = v_claim.anon_user_id;
  get diagnostics v_transferred_profile_events = row_count;

  update public.trip_versions v
     set created_by = v_uid
   where v.created_by = v_claim.anon_user_id;
  get diagnostics v_transferred_trip_versions = row_count;

  update public.trip_shares s
     set created_by = v_uid
   where s.created_by = v_claim.anon_user_id;
  get diagnostics v_transferred_trip_shares = row_count;

  delete from public.trip_collaborators tc
   where tc.user_id = v_claim.anon_user_id
     and exists (
      select 1
        from public.trip_collaborators existing
       where existing.trip_id = tc.trip_id
         and existing.user_id = v_uid
    );
  get diagnostics v_deduplicated_collaborators = row_count;

  update public.trip_collaborators tc
     set user_id = v_uid
   where tc.user_id = v_claim.anon_user_id;
  get diagnostics v_transferred_collaborators = row_count;

  v_result := jsonb_build_object(
    'transferred_trips', v_transferred_trips,
    'transferred_trip_events', v_transferred_trip_events,
    'transferred_profile_events', v_transferred_profile_events,
    'transferred_trip_versions', v_transferred_trip_versions,
    'transferred_trip_shares', v_transferred_trip_shares,
    'transferred_collaborators', v_transferred_collaborators,
    'deduplicated_collaborators', v_deduplicated_collaborators
  );

  update public.anonymous_asset_claims c
     set status = 'claimed',
         target_user_id = v_uid,
         claimed_at = now(),
         failed_at = null,
         result = v_result,
         updated_at = now()
   where c.id = v_claim.id;

  return query select
    v_claim.id,
    'claimed'::text,
    v_uid,
    v_claim.anon_user_id,
    v_transferred_trips,
    v_transferred_trip_events,
    v_transferred_profile_events,
    v_transferred_trip_versions,
    v_transferred_trip_shares,
    v_transferred_collaborators,
    v_deduplicated_collaborators;
end;
$$;

create or replace function public.expire_stale_anonymous_asset_claims()
returns integer
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_count integer;
begin
  update public.anonymous_asset_claims c
     set status = 'expired',
         failed_at = coalesce(c.failed_at, now()),
         updated_at = now()
   where c.status = 'pending'
     and c.expires_at <= now();

  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$$;

create or replace function public.purge_claimed_anonymous_users(
  p_limit integer default 100,
  p_remove_all boolean default true
)
returns table(
  deleted_users integer,
  deleted_claim_rows integer,
  skipped_users integer
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_deleted_users integer := 0;
  v_deleted_claim_rows integer := 0;
  v_skipped_users integer := 0;
begin
  if auth.uid() is not null and not public.has_admin_permission('users.hard_delete') then
    raise exception 'Not allowed';
  end if;

  with anonymous_users as (
    select u.id
      from auth.users u
     where coalesce((u.raw_app_meta_data ->> 'provider') = 'anonymous', false)
        or coalesce((u.raw_app_meta_data -> 'providers') ? 'anonymous', false)
        or coalesce((u.raw_user_meta_data ->> 'is_anonymous')::boolean, false)
  ),
  candidates as (
    select au.id
      from anonymous_users au
     where (
      p_remove_all
      or (
        not exists (select 1 from public.trips t where t.owner_id = au.id)
        and not exists (
          select 1
            from public.anonymous_asset_claims c
           where c.anon_user_id = au.id
             and c.status = 'pending'
             and c.expires_at > now()
        )
      )
    )
    limit greatest(coalesce(p_limit, 100), 1)
  ),
  removed_claims as (
    delete from public.anonymous_asset_claims c
     where c.anon_user_id in (select id from candidates)
    returning c.id
  ),
  removed_users as (
    delete from auth.users u
     where u.id in (select id from candidates)
    returning u.id
  )
  select
    (select count(*)::integer from removed_users),
    (select count(*)::integer from removed_claims),
    greatest(
      (select count(*)::integer from anonymous_users) - (select count(*)::integer from candidates),
      0
    )
    into v_deleted_users, v_deleted_claim_rows, v_skipped_users;

  return query select v_deleted_users, v_deleted_claim_rows, v_skipped_users;
end;
$$;

drop function if exists public.admin_reset_anonymous_users_and_logs(boolean, boolean, boolean, boolean, boolean);
create or replace function public.admin_reset_anonymous_users_and_logs(
  p_delete_anonymous_users boolean default true,
  p_delete_profile_user_events boolean default true,
  p_delete_trip_user_events boolean default true,
  p_delete_admin_audit_logs boolean default true,
  p_delete_trip_versions boolean default false
)
returns table(
  deleted_profile_user_events integer,
  deleted_trip_user_events integer,
  deleted_admin_audit_logs integer,
  deleted_trip_versions integer,
  deleted_anonymous_claims integer,
  deleted_anonymous_users integer
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_deleted_profile_user_events integer := 0;
  v_deleted_trip_user_events integer := 0;
  v_deleted_admin_audit_logs integer := 0;
  v_deleted_trip_versions integer := 0;
  v_deleted_anonymous_claims integer := 0;
  v_deleted_anonymous_users integer := 0;
begin
  if auth.uid() is not null then
    if not public.has_admin_permission('users.hard_delete') then
      raise exception 'Not allowed';
    end if;
    if not public.has_admin_permission('audit.write') then
      raise exception 'Not allowed';
    end if;
  end if;

  if p_delete_profile_user_events then
    delete from public.profile_user_events;
    get diagnostics v_deleted_profile_user_events = row_count;
  end if;

  if p_delete_trip_user_events then
    delete from public.trip_user_events;
    get diagnostics v_deleted_trip_user_events = row_count;
  end if;

  if p_delete_admin_audit_logs then
    delete from public.admin_audit_logs;
    get diagnostics v_deleted_admin_audit_logs = row_count;
  end if;

  if p_delete_trip_versions then
    delete from public.trip_versions;
    get diagnostics v_deleted_trip_versions = row_count;
  end if;

  if p_delete_anonymous_users then
    with anonymous_users as (
      select u.id
        from auth.users u
       where coalesce((u.raw_app_meta_data ->> 'provider') = 'anonymous', false)
          or coalesce((u.raw_app_meta_data -> 'providers') ? 'anonymous', false)
          or coalesce((u.raw_user_meta_data ->> 'is_anonymous')::boolean, false)
    ),
    removed_claims as (
      delete from public.anonymous_asset_claims c
       where c.anon_user_id in (select id from anonymous_users)
      returning c.id
    ),
    removed_users as (
      delete from auth.users u
       where u.id in (select id from anonymous_users)
      returning u.id
    )
    select
      (select count(*)::integer from removed_claims),
      (select count(*)::integer from removed_users)
      into v_deleted_anonymous_claims, v_deleted_anonymous_users;
  else
    with anonymous_claims as (
      delete from public.anonymous_asset_claims c
       where exists (
        select 1
          from auth.users u
         where u.id = c.anon_user_id
           and (
             coalesce((u.raw_app_meta_data ->> 'provider') = 'anonymous', false)
             or coalesce((u.raw_app_meta_data -> 'providers') ? 'anonymous', false)
             or coalesce((u.raw_user_meta_data ->> 'is_anonymous')::boolean, false)
           )
      )
      returning c.id
    )
    select count(*)::integer into v_deleted_anonymous_claims from anonymous_claims;
  end if;

  return query
  select
    coalesce(v_deleted_profile_user_events, 0),
    coalesce(v_deleted_trip_user_events, 0),
    coalesce(v_deleted_admin_audit_logs, 0),
    coalesce(v_deleted_trip_versions, 0),
    coalesce(v_deleted_anonymous_claims, 0),
    coalesce(v_deleted_anonymous_users, 0);
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
  v_source text;
  v_status_before text;
  v_status_after text;
  v_title_before text;
  v_title_after text;
  v_trip_expires_before timestamptz;
  v_trip_expires_after timestamptz;
  v_source_kind_before text;
  v_source_kind_after text;
begin
  v_owner := auth.uid();
  if v_owner is null then
    raise exception 'Not authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('trip-upsert:' || coalesce(p_id, ''), 0));

  v_source := nullif(current_setting('app.trip_update_source', true), '');

  v_status := case
    when p_status in ('active', 'archived', 'expired') then p_status
    else 'active'
  end;

  if exists (select 1 from public.trips t where t.id = p_id) then
    if not exists (select 1 from public.trips t where t.id = p_id and t.owner_id = v_owner) then
      raise exception 'Not allowed';
    end if;

    select
      t.status,
      t.title,
      t.trip_expires_at,
      t.source_kind
      into v_status_before, v_title_before, v_trip_expires_before, v_source_kind_before
      from public.trips t
     where t.id = p_id
       and t.owner_id = v_owner
     limit 1;

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
     where id = p_id
     returning
       status,
       title,
       trip_expires_at,
       source_kind
      into v_status_after, v_title_after, v_trip_expires_after, v_source_kind_after;

    if v_status_before is distinct from v_status_after
      or v_title_before is distinct from v_title_after
      or v_trip_expires_before is distinct from v_trip_expires_after
      or v_source_kind_before is distinct from v_source_kind_after then
      insert into public.trip_user_events (trip_id, owner_id, action, source, metadata)
      values (
        p_id,
        v_owner,
        'trip.updated',
        coalesce(v_source, p_source_kind, 'trip.editor'),
        jsonb_build_object(
          'trip_id', p_id,
          'status_before', v_status_before,
          'status_after', v_status_after,
          'title_before', v_title_before,
          'title_after', v_title_after,
          'trip_expires_at_before', v_trip_expires_before,
          'trip_expires_at_after', v_trip_expires_after,
          'source_kind_before', v_source_kind_before,
          'source_kind_after', v_source_kind_after
        )
      );
    end if;
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
    )
    returning
      status,
      title,
      trip_expires_at,
      source_kind
      into v_status_after, v_title_after, v_trip_expires_after, v_source_kind_after;

    insert into public.trip_user_events (trip_id, owner_id, action, source, metadata)
    values (
      p_id,
      v_owner,
      'trip.created',
      coalesce(v_source, p_source_kind, 'trip.editor'),
      jsonb_build_object(
        'trip_id', p_id,
        'status_after', v_status_after,
        'title_after', v_title_after,
        'trip_expires_at_after', v_trip_expires_after,
        'source_kind_after', v_source_kind_after
      )
    );
  end if;

  return query select p_id as trip_id;
end;
$$;

alter table public.auth_flow_logs enable row level security;
alter table public.trip_generation_requests enable row level security;
alter table public.trip_generation_attempts enable row level security;
alter table public.trip_generation_jobs enable row level security;
alter table public.anonymous_asset_claims enable row level security;
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

drop policy if exists "Trip generation attempts owner or admin read" on public.trip_generation_attempts;
create policy "Trip generation attempts owner or admin read"
on public.trip_generation_attempts for select
using (owner_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "Trip generation attempts owner or admin insert" on public.trip_generation_attempts;
create policy "Trip generation attempts owner or admin insert"
on public.trip_generation_attempts for insert
with check (owner_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "Trip generation attempts owner or admin update" on public.trip_generation_attempts;
create policy "Trip generation attempts owner or admin update"
on public.trip_generation_attempts for update
using (owner_id = auth.uid() or public.is_admin(auth.uid()))
with check (owner_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "Trip generation jobs owner or admin read" on public.trip_generation_jobs;
create policy "Trip generation jobs owner or admin read"
on public.trip_generation_jobs for select
using (owner_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "Trip generation jobs owner or admin insert" on public.trip_generation_jobs;
create policy "Trip generation jobs owner or admin insert"
on public.trip_generation_jobs for insert
with check (owner_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "Trip generation jobs owner or admin update" on public.trip_generation_jobs;
create policy "Trip generation jobs owner or admin update"
on public.trip_generation_jobs for update
using (owner_id = auth.uid() or public.is_admin(auth.uid()))
with check (owner_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "Anonymous asset claims owner read" on public.anonymous_asset_claims;
create policy "Anonymous asset claims owner read"
on public.anonymous_asset_claims for select
using (
  anon_user_id = auth.uid()
  or target_user_id = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists "Admin allowlist admin manage" on public.admin_allowlist;
create policy "Admin allowlist admin manage"
on public.admin_allowlist for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

grant execute on function public.get_current_user_access() to anon, authenticated;
grant execute on function public.get_current_user_subscription_summary() to authenticated;
grant execute on function public.admin_list_users(integer, integer, text) to authenticated;
grant execute on function public.admin_update_user_tier(uuid, text) to authenticated;
grant execute on function public.admin_update_user_overrides(uuid, jsonb) to authenticated;
grant execute on function public.admin_update_plan_entitlements(text, jsonb) to authenticated;
grant execute on function public.log_auth_flow(text, text, text, text, text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.create_trip_generation_request(text, jsonb, integer) to anon, authenticated;
grant execute on function public.claim_trip_generation_request(uuid) to authenticated;
grant execute on function public.expire_stale_trip_generation_requests() to anon, authenticated;
grant execute on function public.trip_generation_attempt_start(text, text, text, text, text, text, text, text, timestamptz, jsonb) to authenticated;
grant execute on function public.trip_generation_attempt_start(text, text, text, text, text, text, text, text, timestamptz, jsonb) to service_role;
grant execute on function public.trip_generation_attempt_finish(uuid, text, text, text, text, text, timestamptz, integer, integer, text, text, text, jsonb) to authenticated;
grant execute on function public.trip_generation_attempt_finish(uuid, text, text, text, text, text, timestamptz, integer, integer, text, text, text, jsonb) to service_role;
grant execute on function public.trip_generation_attempt_list_owner(text, integer) to authenticated;
grant execute on function public.trip_generation_attempt_list_admin(text, integer) to authenticated;
grant execute on function public.trip_generation_job_enqueue(text, uuid, jsonb, integer, timestamptz, integer) to authenticated;
grant execute on function public.trip_generation_job_enqueue(text, uuid, jsonb, integer, timestamptz, integer) to service_role;
grant execute on function public.trip_generation_job_claim(text, integer, integer) to authenticated;
grant execute on function public.trip_generation_job_claim(text, integer, integer) to service_role;
grant execute on function public.trip_generation_job_heartbeat(uuid, text, integer) to authenticated;
grant execute on function public.trip_generation_job_heartbeat(uuid, text, integer) to service_role;
grant execute on function public.trip_generation_job_complete(uuid, text) to authenticated;
grant execute on function public.trip_generation_job_complete(uuid, text) to service_role;
grant execute on function public.trip_generation_job_fail(uuid, text, text, text, integer, boolean) to authenticated;
grant execute on function public.trip_generation_job_fail(uuid, text, text, text, integer, boolean) to service_role;
grant execute on function public.trip_generation_job_requeue(uuid, text, timestamptz, boolean) to authenticated;
grant execute on function public.trip_generation_job_requeue(uuid, text, timestamptz, boolean) to service_role;
grant execute on function public.create_anonymous_asset_claim(integer) to authenticated;
grant execute on function public.claim_anonymous_assets(uuid) to authenticated;
grant execute on function public.expire_stale_anonymous_asset_claims() to anon, authenticated;
grant execute on function public.purge_claimed_anonymous_users(integer, boolean) to authenticated;
grant execute on function public.admin_reset_anonymous_users_and_logs(boolean, boolean, boolean, boolean, boolean) to authenticated;
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
  ('billing.read', 'Read billing', 'billing', 'Inspect subscription state and billing webhook delivery records.'),
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
  ('support_admin', 'billing.read'),
  ('support_admin', 'audit.read'),
  ('support_admin', 'audit.write')
on conflict (role_key, permission_key) do nothing;

insert into public.admin_role_permissions (role_key, permission_key)
values
  ('read_only_admin', 'users.read'),
  ('read_only_admin', 'trips.read'),
  ('read_only_admin', 'tiers.read'),
  ('read_only_admin', 'billing.read'),
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
  onboarding_completed boolean,
  provider_subscription_id text,
  provider_status text,
  subscription_status text,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  grace_ends_at timestamptz,
  billing_access_until timestamptz,
  terms_current_version text,
  terms_requires_reaccept boolean,
  terms_accepted_version text,
  terms_accepted_at timestamptz,
  terms_acceptance_required boolean,
  terms_notice_required boolean
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
  v_effective_tier text;
  v_is_anonymous boolean;
  v_account_status text;
  v_onboarding_completed boolean;
  v_provider_subscription_id text;
  v_provider_status text;
  v_subscription_status text;
  v_current_period_end timestamptz;
  v_cancel_at timestamptz;
  v_canceled_at timestamptz;
  v_grace_ends_at timestamptz;
  v_billing_access_until timestamptz;
  v_terms_current_version text;
  v_terms_requires_reaccept boolean;
  v_terms_accepted_version text;
  v_terms_accepted_at timestamptz;
  v_terms_acceptance_required boolean;
  v_terms_notice_required boolean;
  v_normalized_subscription_status text;
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
    s.provider_subscription_id,
    s.provider_status,
    s.status,
    s.current_period_end,
    s.cancel_at,
    s.canceled_at,
    s.grace_ends_at,
    p.terms_accepted_version,
    p.terms_accepted_at,
    (
      p.onboarding_completed_at is not null
      and coalesce(btrim(p.first_name), '') <> ''
      and coalesce(btrim(p.last_name), '') <> ''
      and coalesce(btrim(p.country), '') <> ''
      and coalesce(btrim(p.city), '') <> ''
      and coalesce(btrim(p.preferred_language), '') <> ''
    )
    into
      v_role,
      v_tier,
      v_account_status,
      v_provider_subscription_id,
      v_provider_status,
      v_subscription_status,
      v_current_period_end,
      v_cancel_at,
      v_canceled_at,
      v_grace_ends_at,
      v_terms_accepted_version,
      v_terms_accepted_at,
      v_onboarding_completed
    from public.profiles p
    left join public.subscriptions s on s.user_id = p.id
   where p.id = v_uid;

  v_is_anonymous := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  v_normalized_subscription_status := lower(coalesce(nullif(v_provider_status, ''), nullif(v_subscription_status, ''), 'none'));
  v_effective_tier := coalesce(v_tier, 'tier_free');

  if v_normalized_subscription_status in ('paused', 'inactive') then
    v_effective_tier := 'tier_free';
  elsif v_normalized_subscription_status = 'canceled' and (v_grace_ends_at is null or v_grace_ends_at <= now()) then
    v_effective_tier := 'tier_free';
  end if;

  v_billing_access_until := case
    when v_normalized_subscription_status = 'canceled' then coalesce(v_grace_ends_at, v_current_period_end, v_cancel_at)
    else v_current_period_end
  end;

  select
    ltv.version,
    ltv.requires_reaccept
    into v_terms_current_version, v_terms_requires_reaccept
    from public.legal_terms_versions ltv
   where ltv.is_current = true
   order by ltv.effective_at desc, ltv.created_at desc
   limit 1;

  v_terms_acceptance_required := (
    v_terms_current_version is not null
    and (
      v_terms_accepted_version is null
      or (
        v_terms_accepted_version <> v_terms_current_version
        and coalesce(v_terms_requires_reaccept, true)
      )
    )
  );

  v_terms_notice_required := (
    v_terms_current_version is not null
    and coalesce(v_terms_accepted_version, '') <> v_terms_current_version
    and not coalesce(v_terms_requires_reaccept, true)
  );

  return query
  select
    v_uid,
    v_email,
    v_is_anonymous,
    coalesce(v_role, 'user'),
    coalesce(v_effective_tier, 'tier_free'),
    public.get_effective_entitlements(v_uid),
    coalesce(v_account_status, 'active'),
    coalesce(v_onboarding_completed, false),
    v_provider_subscription_id,
    nullif(v_provider_status, ''),
    nullif(v_subscription_status, ''),
    v_current_period_end,
    v_cancel_at,
    v_canceled_at,
    v_grace_ends_at,
    v_billing_access_until,
    v_terms_current_version,
    coalesce(v_terms_requires_reaccept, true),
    v_terms_accepted_version,
    v_terms_accepted_at,
    coalesce(v_terms_acceptance_required, false),
    coalesce(v_terms_notice_required, false);
end;
$$;

drop function if exists public.accept_current_terms(text, text);
create or replace function public.accept_current_terms(
  p_locale text default null,
  p_source text default null
)
returns table(
  terms_version text,
  accepted_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
#variable_conflict use_column
declare
  v_uid uuid;
  v_terms_version text;
  v_terms_accepted_at timestamptz;
  v_accepted_locale text;
  v_acceptance_source text;
  v_before_terms_version text;
  v_before_terms_accepted_at timestamptz;
  v_before_terms_locale text;
  v_before_terms_source text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select ltv.version
    into v_terms_version
    from public.legal_terms_versions ltv
   where ltv.is_current = true
   order by ltv.effective_at desc, ltv.created_at desc
   limit 1;

  if v_terms_version is null then
    raise exception 'Current terms version is not configured';
  end if;

  v_accepted_locale := nullif(btrim(coalesce(p_locale, '')), '');
  v_acceptance_source := nullif(btrim(coalesce(p_source, '')), '');

  begin
    insert into public.legal_terms_acceptance_events (
      user_id,
      terms_version,
      accepted_locale,
      source
    )
    select
      v_uid,
      v_terms_version,
      v_accepted_locale,
      v_acceptance_source
    where not exists (
      select 1
        from public.legal_terms_acceptance_events lta
       where lta.user_id = v_uid
         and lta.terms_version = v_terms_version
    );
  exception
    when unique_violation then
      -- Concurrent accept requests can race; unique index resolves the winner.
      null;
  end;

  select lta.accepted_at
    into v_terms_accepted_at
    from public.legal_terms_acceptance_events lta
   where lta.user_id = v_uid
     and lta.terms_version = v_terms_version
   order by lta.accepted_at desc
   limit 1;

  if v_terms_accepted_at is null then
    v_terms_accepted_at := now();
  end if;

  select
    p.terms_accepted_version,
    p.terms_accepted_at,
    p.terms_accepted_locale,
    p.terms_acceptance_source
    into
      v_before_terms_version,
      v_before_terms_accepted_at,
      v_before_terms_locale,
      v_before_terms_source
  from public.profiles p
  where p.id = v_uid;

  update public.profiles p
     set terms_accepted_version = v_terms_version,
         terms_accepted_at = v_terms_accepted_at,
         terms_accepted_locale = v_accepted_locale,
         terms_acceptance_source = v_acceptance_source
   where p.id = v_uid;

  insert into public.profile_user_events (
    owner_id,
    action,
    source,
    before_data,
    after_data,
    metadata
  )
  values (
    v_uid,
    'legal.terms.accepted',
    v_acceptance_source,
    jsonb_build_object(
      'terms_accepted_version', v_before_terms_version,
      'terms_accepted_at', v_before_terms_accepted_at,
      'terms_accepted_locale', v_before_terms_locale,
      'terms_acceptance_source', v_before_terms_source
    ),
    jsonb_build_object(
      'terms_accepted_version', v_terms_version,
      'terms_accepted_at', v_terms_accepted_at,
      'terms_accepted_locale', v_accepted_locale,
      'terms_acceptance_source', v_acceptance_source
    ),
    jsonb_build_object(
      'terms_version', v_terms_version,
      'accepted_at', v_terms_accepted_at,
      'locale', v_accepted_locale
    )
  );

  return query
  select
    v_terms_version,
    v_terms_accepted_at;
end;
$$;

drop function if exists public.admin_publish_terms_version(text, text, text, text, date, timestamptz, boolean, text, text, boolean);
create or replace function public.admin_publish_terms_version(
  p_version text,
  p_title text,
  p_summary text default null,
  p_binding_locale text default 'de',
  p_last_updated date default current_date,
  p_effective_at timestamptz default now(),
  p_requires_reaccept boolean default true,
  p_content_de text default null,
  p_content_en text default null,
  p_make_current boolean default true
)
returns table(
  version text,
  title text,
  summary text,
  binding_locale text,
  last_updated date,
  effective_at timestamptz,
  requires_reaccept boolean,
  is_current boolean,
  content_de text,
  content_en text,
  created_at timestamptz,
  created_by uuid
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
#variable_conflict use_column
declare
  v_version text;
  v_title text;
  v_summary text;
  v_binding_locale text;
  v_content_de text;
  v_content_en text;
  v_before jsonb;
  v_after jsonb;
begin
  if not public.has_admin_permission('users.write') then
    raise exception 'Not allowed';
  end if;

  v_version := nullif(btrim(coalesce(p_version, '')), '');
  v_title := nullif(btrim(coalesce(p_title, '')), '');
  v_summary := nullif(btrim(coalesce(p_summary, '')), '');
  v_binding_locale := coalesce(nullif(btrim(coalesce(p_binding_locale, '')), ''), 'de');
  v_content_de := nullif(btrim(coalesce(p_content_de, '')), '');
  v_content_en := nullif(btrim(coalesce(p_content_en, '')), '');

  if v_version is null then
    raise exception 'Version is required';
  end if;
  if v_title is null then
    raise exception 'Title is required';
  end if;
  if v_content_de is null or v_content_en is null then
    raise exception 'Both German and English terms content are required';
  end if;

  if exists (
    select 1
      from public.legal_terms_versions ltv
     where ltv.version = v_version
  ) then
    raise exception 'Version "%" already exists. Publish a new version.', v_version;
  end if;

  select to_jsonb(ltv) into v_before
    from public.legal_terms_versions ltv
   where ltv.version = v_version;

  if coalesce(p_make_current, true) then
    update public.legal_terms_versions ltv
       set is_current = false
     where ltv.is_current = true
       and ltv.version <> v_version;
  end if;

  insert into public.legal_terms_versions (
    version,
    title,
    summary,
    binding_locale,
    content_de,
    content_en,
    last_updated,
    effective_at,
    requires_reaccept,
    is_current,
    created_by
  )
  values (
    v_version,
    v_title,
    v_summary,
    v_binding_locale,
    v_content_de,
    v_content_en,
    coalesce(p_last_updated, current_date),
    coalesce(p_effective_at, now()),
    coalesce(p_requires_reaccept, true),
    coalesce(p_make_current, true),
    auth.uid()
  )
  ;

  select to_jsonb(ltv) into v_after
    from public.legal_terms_versions ltv
   where ltv.version = v_version;

  perform public.admin_write_audit(
    'admin.terms.publish',
    'legal_terms_version',
    v_version,
    coalesce(v_before, '{}'::jsonb),
    coalesce(v_after, '{}'::jsonb),
    jsonb_build_object(
      'make_current', coalesce(p_make_current, true),
      'requires_reaccept', coalesce(p_requires_reaccept, true),
      'binding_locale', v_binding_locale
    )
  );

  return query
  select
    ltv.version,
    ltv.title,
    ltv.summary,
    ltv.binding_locale,
    ltv.last_updated,
    ltv.effective_at,
    ltv.requires_reaccept,
    ltv.is_current,
    ltv.content_de,
    ltv.content_en,
    ltv.created_at,
    ltv.created_by
  from public.legal_terms_versions ltv
  where ltv.version = v_version
  limit 1;
end;
$$;

drop function if exists public.admin_set_current_terms_version(text, timestamptz, boolean);
create or replace function public.admin_set_current_terms_version(
  p_version text,
  p_effective_at timestamptz default now(),
  p_requires_reaccept boolean default null
)
returns table(
  version text,
  title text,
  summary text,
  binding_locale text,
  last_updated date,
  effective_at timestamptz,
  requires_reaccept boolean,
  is_current boolean,
  content_de text,
  content_en text,
  created_at timestamptz,
  created_by uuid
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
#variable_conflict use_column
declare
  v_version text;
  v_target_before jsonb;
  v_target_after jsonb;
  v_previous_current text;
begin
  if not public.has_admin_permission('users.write') then
    raise exception 'Not allowed';
  end if;

  v_version := nullif(btrim(coalesce(p_version, '')), '');
  if v_version is null then
    raise exception 'Version is required';
  end if;

  select to_jsonb(ltv) into v_target_before
    from public.legal_terms_versions ltv
   where ltv.version = v_version;

  if v_target_before is null then
    raise exception 'Unknown terms version';
  end if;

  select ltv.version
    into v_previous_current
    from public.legal_terms_versions ltv
   where ltv.is_current = true
   order by ltv.effective_at desc, ltv.created_at desc
   limit 1;

  update public.legal_terms_versions ltv
     set is_current = false
   where ltv.is_current = true
     and ltv.version <> v_version;

  update public.legal_terms_versions ltv
     set is_current = true,
         effective_at = coalesce(p_effective_at, ltv.effective_at),
         requires_reaccept = coalesce(p_requires_reaccept, ltv.requires_reaccept)
   where ltv.version = v_version;

  select to_jsonb(ltv) into v_target_after
    from public.legal_terms_versions ltv
   where ltv.version = v_version;

  perform public.admin_write_audit(
    'admin.terms.set_current',
    'legal_terms_version',
    v_version,
    coalesce(v_target_before, '{}'::jsonb),
    coalesce(v_target_after, '{}'::jsonb),
    jsonb_build_object(
      'previous_current_version', v_previous_current,
      'new_current_version', v_version,
      'requires_reaccept_override', p_requires_reaccept
    )
  );

  return query
  select
    ltv.version,
    ltv.title,
    ltv.summary,
    ltv.binding_locale,
    ltv.last_updated,
    ltv.effective_at,
    ltv.requires_reaccept,
    ltv.is_current,
    ltv.content_de,
    ltv.content_en,
    ltv.created_at,
    ltv.created_by
  from public.legal_terms_versions ltv
  where ltv.version = v_version
  limit 1;
end;
$$;

alter table public.profiles add column if not exists username_display text;

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

drop function if exists public.admin_list_billing_subscriptions(integer, integer, text);
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

drop function if exists public.admin_get_billing_dashboard();
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

drop function if exists public.admin_list_billing_webhook_events(integer, integer, text);
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

drop function if exists public.admin_list_audit_logs(integer, integer, text, text, uuid);
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

create or replace function public.admin_list_user_change_logs(
  p_limit integer default 200,
  p_offset integer default 0,
  p_action text default null,
  p_owner_user_id uuid default null
)
returns table(
  id uuid,
  owner_user_id uuid,
  owner_email text,
  action text,
  source text,
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
  with profile_changes as (
    select
      e.id,
      e.owner_id as owner_user_id,
      u.email::text as owner_email,
      e.action,
      e.source,
      'user'::text as target_type,
      e.owner_id::text as target_id,
      e.before_data,
      e.after_data,
      e.metadata,
      e.created_at
    from public.profile_user_events e
    left join auth.users u on u.id = e.owner_id
  ),
  trip_changes as (
    select
      e.id,
      e.owner_id as owner_user_id,
      u.email::text as owner_email,
      e.action,
      e.source,
      'trip'::text as target_type,
      e.trip_id::text as target_id,
      null::jsonb as before_data,
      null::jsonb as after_data,
      e.metadata,
      e.created_at
    from public.trip_user_events e
    left join auth.users u on u.id = e.owner_id
  ),
  combined as (
    select * from profile_changes
    union all
    select * from trip_changes
  )
  select
    c.id,
    c.owner_user_id,
    c.owner_email,
    c.action,
    c.source,
    c.target_type,
    c.target_id,
    c.before_data,
    c.after_data,
    c.metadata,
    c.created_at
  from combined c
  where (p_action is null or p_action = '' or c.action = p_action)
    and (p_owner_user_id is null or c.owner_user_id = p_owner_user_id)
  order by c.created_at desc
  limit greatest(coalesce(p_limit, 200), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_get_user_change_log(
  p_event_id uuid
)
returns table(
  id uuid,
  owner_user_id uuid,
  owner_email text,
  action text,
  source text,
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
  with profile_changes as (
    select
      e.id,
      e.owner_id as owner_user_id,
      u.email::text as owner_email,
      e.action,
      e.source,
      'user'::text as target_type,
      e.owner_id::text as target_id,
      e.before_data,
      e.after_data,
      e.metadata,
      e.created_at
    from public.profile_user_events e
    left join auth.users u on u.id = e.owner_id
    where e.id = p_event_id
  ),
  trip_changes as (
    select
      e.id,
      e.owner_id as owner_user_id,
      u.email::text as owner_email,
      e.action,
      e.source,
      'trip'::text as target_type,
      e.trip_id::text as target_id,
      null::jsonb as before_data,
      null::jsonb as after_data,
      e.metadata,
      e.created_at
    from public.trip_user_events e
    left join auth.users u on u.id = e.owner_id
    where e.id = p_event_id
  ),
  combined as (
    select * from profile_changes
    union all
    select * from trip_changes
  )
  select
    c.id,
    c.owner_user_id,
    c.owner_email,
    c.action,
    c.source,
    c.target_type,
    c.target_id,
    c.before_data,
    c.after_data,
    c.metadata,
    c.created_at
  from combined c
  order by c.created_at desc
  limit 1;
end;
$$;

drop function if exists public.admin_get_trip_version_snapshots(text, uuid, uuid);
create or replace function public.admin_get_trip_version_snapshots(
  p_trip_id text,
  p_after_version_id uuid default null,
  p_before_version_id uuid default null
)
returns table(
  trip_id text,
  before_version_id uuid,
  after_version_id uuid,
  before_snapshot jsonb,
  after_snapshot jsonb,
  before_view_settings jsonb,
  after_view_settings jsonb,
  before_label text,
  after_label text,
  before_created_at timestamptz,
  after_created_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_trip_id text;
  v_after public.trip_versions%rowtype;
  v_before public.trip_versions%rowtype;
begin
  if not public.has_admin_permission('audit.read') then
    raise exception 'Not allowed';
  end if;

  v_trip_id := nullif(btrim(coalesce(p_trip_id, '')), '');
  if v_trip_id is null then
    raise exception 'Trip id is required';
  end if;

  if p_after_version_id is not null then
    select tv.*
      into v_after
      from public.trip_versions tv
     where tv.id = p_after_version_id
       and tv.trip_id = v_trip_id
     limit 1;
  else
    select tv.*
      into v_after
      from public.trip_versions tv
     where tv.trip_id = v_trip_id
     order by tv.created_at desc
     limit 1;
  end if;

  if v_after.id is null then
    return query
    select
      v_trip_id,
      null::uuid,
      null::uuid,
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      null::text,
      null::text,
      null::timestamptz,
      null::timestamptz;
    return;
  end if;

  if p_before_version_id is not null then
    select tv.*
      into v_before
      from public.trip_versions tv
     where tv.id = p_before_version_id
       and tv.trip_id = v_trip_id
     limit 1;
  end if;

  if v_before.id is null then
    select tv.*
      into v_before
      from public.trip_versions tv
     where tv.trip_id = v_trip_id
       and tv.version_number < v_after.version_number
     order by tv.version_number desc, tv.created_at desc
     limit 1;
  end if;

  return query
  select
    v_trip_id,
    v_before.id,
    v_after.id,
    coalesce(v_before.data, '{}'::jsonb),
    coalesce(v_after.data, '{}'::jsonb),
    coalesce(v_before.view_settings, '{}'::jsonb),
    coalesce(v_after.view_settings, '{}'::jsonb),
    v_before.label,
    v_after.label,
    v_before.created_at,
    v_after.created_at;
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

drop function if exists public.get_public_runtime_settings();
create or replace function public.get_public_runtime_settings()
returns table(
  planner_beta_open boolean,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    ars.planner_beta_open,
    ars.updated_at
  from public.app_runtime_settings ars
  where ars.singleton = true
  limit 1;
$$;

drop function if exists public.admin_update_runtime_settings(boolean);
create or replace function public.admin_update_runtime_settings(
  p_planner_beta_open boolean
)
returns public.app_runtime_settings
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
  v_result public.app_runtime_settings%rowtype;
begin
  if not public.is_admin(v_uid) then
    raise exception 'Not allowed';
  end if;

  insert into public.app_runtime_settings as ars (
    singleton,
    planner_beta_open,
    updated_at,
    updated_by
  )
  values (
    true,
    coalesce(p_planner_beta_open, false),
    now(),
    v_uid
  )
  on conflict (singleton) do update
  set planner_beta_open = excluded.planner_beta_open,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;

  select *
  into v_result
  from public.app_runtime_settings ars
  where ars.singleton = true
  limit 1;

  return v_result;
end;
$$;

grant execute on function public.get_current_user_access() to anon, authenticated;
grant execute on function public.accept_current_terms(text, text) to authenticated;
grant execute on function public.admin_publish_terms_version(text, text, text, text, date, timestamptz, boolean, text, text, boolean) to authenticated;
grant execute on function public.admin_set_current_terms_version(text, timestamptz, boolean) to authenticated;
grant execute on function public.has_admin_permission(text, uuid) to authenticated;
grant execute on function public.admin_write_audit(text, text, text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.admin_list_users(integer, integer, text) to authenticated;
grant execute on function public.admin_get_user_profile(uuid) to authenticated;
grant execute on function public.admin_update_user_profile(uuid, text, text, text, text, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.admin_reset_user_username_cooldown(uuid, text) to authenticated;
grant execute on function public.admin_reset_user_terms_acceptance(uuid, text) to authenticated;
grant execute on function public.admin_update_user_tier(uuid, text) to authenticated;
grant execute on function public.admin_update_user_overrides(uuid, jsonb) to authenticated;
grant execute on function public.admin_update_plan_entitlements(text, jsonb) to authenticated;
grant execute on function public.get_public_runtime_settings() to anon, authenticated;
grant execute on function public.admin_update_runtime_settings(boolean) to authenticated;
grant execute on function public.trip_generation_attempt_start(text, text, text, text, text, text, text, text, timestamptz, jsonb) to authenticated;
grant execute on function public.trip_generation_attempt_start(text, text, text, text, text, text, text, text, timestamptz, jsonb) to service_role;
grant execute on function public.trip_generation_attempt_finish(uuid, text, text, text, text, text, timestamptz, integer, integer, text, text, text, jsonb) to authenticated;
grant execute on function public.trip_generation_attempt_finish(uuid, text, text, text, text, text, timestamptz, integer, integer, text, text, text, jsonb) to service_role;
grant execute on function public.trip_generation_attempt_list_owner(text, integer) to authenticated;
grant execute on function public.trip_generation_attempt_list_admin(text, integer) to authenticated;
grant execute on function public.trip_generation_job_enqueue(text, uuid, jsonb, integer, timestamptz, integer) to authenticated;
grant execute on function public.trip_generation_job_enqueue(text, uuid, jsonb, integer, timestamptz, integer) to service_role;
grant execute on function public.trip_generation_job_claim(text, integer, integer) to authenticated;
grant execute on function public.trip_generation_job_claim(text, integer, integer) to service_role;
grant execute on function public.trip_generation_job_heartbeat(uuid, text, integer) to authenticated;
grant execute on function public.trip_generation_job_heartbeat(uuid, text, integer) to service_role;
grant execute on function public.trip_generation_job_complete(uuid, text) to authenticated;
grant execute on function public.trip_generation_job_complete(uuid, text) to service_role;
grant execute on function public.trip_generation_job_fail(uuid, text, text, text, integer, boolean) to authenticated;
grant execute on function public.trip_generation_job_fail(uuid, text, text, text, integer, boolean) to service_role;
grant execute on function public.trip_generation_job_requeue(uuid, text, timestamptz, boolean) to authenticated;
grant execute on function public.trip_generation_job_requeue(uuid, text, timestamptz, boolean) to service_role;
grant execute on function public.admin_list_trips(integer, integer, text, uuid, text, text) to authenticated;
grant execute on function public.admin_list_user_trips(uuid, integer, integer, text, text) to authenticated;
grant execute on function public.admin_list_billing_subscriptions(integer, integer, text) to authenticated;
grant execute on function public.admin_list_billing_webhook_events(integer, integer, text) to authenticated;
grant execute on function public.admin_get_billing_dashboard() to authenticated;
grant execute on function public.admin_get_trip_for_view(text) to authenticated;
grant execute on function public.admin_override_trip_commit(text, jsonb, jsonb, text, date, boolean, text, jsonb) to authenticated;
grant execute on function public.admin_update_trip(text, text, timestamptz, uuid, boolean, boolean, boolean) to authenticated;
grant execute on function public.admin_hard_delete_trip(text) to authenticated;
grant execute on function public.admin_list_audit_logs(integer, integer, text, text, uuid) to authenticated;
grant execute on function public.admin_list_user_change_logs(integer, integer, text, uuid) to authenticated;
grant execute on function public.admin_get_user_change_log(uuid) to authenticated;
grant execute on function public.admin_get_trip_version_snapshots(text, uuid, uuid) to authenticated;
grant execute on function public.admin_reapply_tier_to_users(text, boolean) to authenticated;
grant execute on function public.admin_preview_tier_reapply(text) to authenticated;

-- =============================================================================
-- Public profile handles + profile visibility extensions
-- =============================================================================

alter table public.trips add column if not exists show_on_public_profile boolean not null default true;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists public_profile_enabled boolean not null default true;
alter table public.profiles add column if not exists default_public_trip_visibility boolean not null default true;
alter table public.profiles add column if not exists username_changed_at timestamptz;
alter table public.profiles add column if not exists username_display text;
alter table public.profiles add column if not exists terms_accepted_version text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists terms_accepted_locale text;
alter table public.profiles add column if not exists terms_acceptance_source text;

update public.profiles p
set username_display = p.username
where p.username is not null
  and nullif(btrim(coalesce(p.username_display, '')), '') is null;

update public.profiles p
set country = upper(btrim(p.country))
where p.country is not null
  and btrim(p.country) ~ '^[a-z]{2}$';

update public.profiles p
set country = 'DE'
where p.country is null
   or nullif(btrim(p.country), '') is null
   or public.profile_normalize_country_code(p.country) is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_country_iso2_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_country_iso2_check
      check (country is null or country ~ '^[A-Z]{2}$');
  end if;
end;
$$;

create or replace function public.profile_apply_country_rules()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_raw_country text := nullif(btrim(coalesce(new.country, '')), '');
  v_country_code text;
begin
  if v_raw_country is null then
    new.country := null;
    return new;
  end if;

  v_country_code := public.profile_normalize_country_code(v_raw_country);

  if v_country_code is null then
    raise exception 'Country/Region must be a valid ISO 3166-1 alpha-2 country code';
  end if;

  new.country := v_country_code;
  return new;
end;
$$;

drop trigger if exists profile_apply_country_rules on public.profiles;
create trigger profile_apply_country_rules
before insert or update of country
on public.profiles
for each row execute function public.profile_apply_country_rules();

create table if not exists public.profile_handle_redirects (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profile_handle_redirects_handle_uidx
  on public.profile_handle_redirects (lower(handle));
create index if not exists profile_handle_redirects_user_idx
  on public.profile_handle_redirects (user_id, expires_at desc);
create index if not exists profile_handle_redirects_expiry_idx
  on public.profile_handle_redirects (expires_at desc);

create table if not exists public.username_blocked_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  category text not null default 'profanity',
  severity smallint not null default 2 check (severity between 1 and 5),
  source text not null default 'manual',
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists username_blocked_terms_term_uidx
  on public.username_blocked_terms (lower(term));
create index if not exists username_blocked_terms_category_idx
  on public.username_blocked_terms (category, active);

create table if not exists public.username_reserved_handles (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  category text not null default 'system_owner',
  owner_assignable boolean not null default true,
  source text not null default 'manual',
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists username_reserved_handles_handle_uidx
  on public.username_reserved_handles (lower(handle));
create index if not exists username_reserved_handles_category_idx
  on public.username_reserved_handles (category, active);

update public.username_blocked_terms
set term = lower(btrim(term))
where term is not null and term <> lower(btrim(term));

delete from public.username_blocked_terms
where nullif(btrim(coalesce(term, '')), '') is null
   or lower(btrim(term)) !~ '^[a-z0-9_-]{3,40}$'
   or lower(btrim(term)) !~ '[a-z0-9]';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'username_blocked_terms_term_format_check'
      and conrelid = 'public.username_blocked_terms'::regclass
  ) then
    alter table public.username_blocked_terms
      add constraint username_blocked_terms_term_format_check
      check (
        lower(btrim(term)) ~ '^[a-z0-9_-]{3,40}$'
        and lower(btrim(term)) ~ '[a-z0-9]'
      );
  end if;
end;
$$;

update public.username_reserved_handles
set handle = lower(btrim(handle))
where handle is not null and handle <> lower(btrim(handle));

delete from public.username_reserved_handles
where nullif(btrim(coalesce(handle, '')), '') is null
   or lower(btrim(handle)) !~ '^[a-z0-9_-]{3,40}$'
   or lower(btrim(handle)) !~ '[a-z0-9]';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'username_reserved_handles_handle_format_check'
      and conrelid = 'public.username_reserved_handles'::regclass
  ) then
    alter table public.username_reserved_handles
      add constraint username_reserved_handles_handle_format_check
      check (
        lower(btrim(handle)) ~ '^[a-z0-9_-]{3,40}$'
        and lower(btrim(handle)) ~ '[a-z0-9]'
      );
  end if;
end;
$$;

insert into public.username_reserved_handles (handle, category, owner_assignable, source, notes)
values
  ('admin', 'system_owner', true, 'seed_v1', 'System owner/admin namespace'),
  ('administrator', 'system_owner', true, 'seed_v1', 'System owner/admin namespace'),
  ('admins', 'system_owner', true, 'seed_v1', 'System owner/admin namespace'),
  ('owner', 'system_owner', true, 'seed_v1', 'System owner/admin namespace'),
  ('team', 'system_owner', true, 'seed_v1', 'System owner/admin namespace'),
  ('staff', 'system_owner', true, 'seed_v1', 'System owner/admin namespace'),
  ('moderator', 'security', true, 'seed_v1', 'Moderation namespace'),
  ('mod', 'security', true, 'seed_v1', 'Moderation namespace'),
  ('support', 'support', true, 'seed_v1', 'Support namespace'),
  ('help', 'support', true, 'seed_v1', 'Support namespace'),
  ('helpdesk', 'support', true, 'seed_v1', 'Support namespace'),
  ('help-desk', 'support', true, 'seed_v1', 'Support namespace'),
  ('helpcenter', 'support', true, 'seed_v1', 'Support namespace'),
  ('help-center', 'support', true, 'seed_v1', 'Support namespace'),
  ('supportteam', 'support', true, 'seed_v1', 'Support namespace'),
  ('support-team', 'support', true, 'seed_v1', 'Support namespace'),
  ('customersupport', 'support', true, 'seed_v1', 'Support namespace'),
  ('customer-support', 'support', true, 'seed_v1', 'Support namespace'),
  ('service', 'support', true, 'seed_v1', 'Support namespace'),
  ('security', 'security', true, 'seed_v1', 'Security namespace'),
  ('safety', 'security', true, 'seed_v1', 'Safety namespace'),
  ('trust', 'security', true, 'seed_v1', 'Trust namespace'),
  ('trustandsafety', 'security', true, 'seed_v1', 'Trust and safety namespace'),
  ('trust-safety', 'security', true, 'seed_v1', 'Trust and safety namespace'),
  ('compliance', 'security', true, 'seed_v1', 'Compliance namespace'),
  ('official', 'security', true, 'seed_v1', 'Official namespace'),
  ('officialteam', 'security', true, 'seed_v1', 'Official namespace'),
  ('official-team', 'security', true, 'seed_v1', 'Official namespace'),
  ('verification', 'security', true, 'seed_v1', 'Verification namespace'),
  ('verify', 'security', true, 'seed_v1', 'Verification namespace'),
  ('verified', 'security', true, 'seed_v1', 'Verification namespace'),
  ('adminsupport', 'security', true, 'seed_v1', 'Impersonation-prone support namespace'),
  ('admin-support', 'security', true, 'seed_v1', 'Impersonation-prone support namespace'),
  ('system', 'system_owner', true, 'seed_v1', 'System namespace'),
  ('noreply', 'system_owner', true, 'seed_v1', 'System namespace'),
  ('no-reply', 'system_owner', true, 'seed_v1', 'System namespace'),
  ('status', 'system_owner', true, 'seed_v1', 'Status namespace'),
  ('statuspage', 'system_owner', true, 'seed_v1', 'Status namespace'),
  ('billing', 'finance', true, 'seed_v1', 'Payments/billing namespace'),
  ('payments', 'finance', true, 'seed_v1', 'Payments/billing namespace'),
  ('refund', 'finance', true, 'seed_v1', 'Payments/billing namespace'),
  ('auth', 'auth', true, 'seed_v1', 'Authentication namespace'),
  ('oauth', 'auth', true, 'seed_v1', 'Authentication namespace'),
  ('login', 'auth', true, 'seed_v1', 'Authentication namespace'),
  ('logout', 'auth', true, 'seed_v1', 'Authentication namespace'),
  ('signup', 'auth', true, 'seed_v1', 'Authentication namespace'),
  ('signin', 'auth', true, 'seed_v1', 'Authentication namespace'),
  ('register', 'auth', true, 'seed_v1', 'Authentication namespace'),
  ('settings', 'platform', true, 'seed_v1', 'Platform namespace'),
  ('profile', 'platform', true, 'seed_v1', 'Platform namespace'),
  ('profiles', 'platform', true, 'seed_v1', 'Platform namespace'),
  ('account', 'platform', true, 'seed_v1', 'Platform namespace'),
  ('accounts', 'platform', true, 'seed_v1', 'Platform namespace'),
  ('api', 'platform', true, 'seed_v1', 'Platform namespace'),
  ('www', 'platform', true, 'seed_v1', 'Web namespace'),
  ('about', 'platform', true, 'seed_v1', 'Platform namespace'),
  ('contact', 'platform', true, 'seed_v1', 'Platform namespace'),
  ('careers', 'platform', true, 'seed_v1', 'Platform namespace'),
  ('jobs', 'platform', true, 'seed_v1', 'Platform namespace'),
  ('blog', 'platform', true, 'seed_v1', 'Platform namespace'),
  ('trip', 'platform', true, 'seed_v1', 'Platform namespace'),
  ('trips', 'platform', true, 'seed_v1', 'Platform namespace'),
  ('create', 'platform', true, 'seed_v1', 'Platform namespace'),
  ('privacy', 'platform', true, 'seed_v1', 'Platform namespace'),
  ('terms', 'platform', true, 'seed_v1', 'Platform namespace'),
  ('cookies', 'platform', true, 'seed_v1', 'Platform namespace'),
  ('imprint', 'platform', true, 'seed_v1', 'Platform namespace'),
  ('tamtam', 'brand', true, 'seed_v1', 'Future brand namespace'),
  ('tamtamapp', 'brand', true, 'seed_v1', 'Future brand namespace'),
  ('tamtam_admin', 'security', true, 'seed_v1', 'Brand impersonation admin namespace'),
  ('tamtam-admin', 'security', true, 'seed_v1', 'Brand impersonation admin namespace'),
  ('admin_tamtam', 'security', true, 'seed_v1', 'Brand impersonation admin namespace'),
  ('admin-tamtam', 'security', true, 'seed_v1', 'Brand impersonation admin namespace'),
  ('tamtam_support', 'support', true, 'seed_v1', 'Brand impersonation support namespace'),
  ('tamtam-support', 'support', true, 'seed_v1', 'Brand impersonation support namespace'),
  ('support_tamtam', 'support', true, 'seed_v1', 'Brand impersonation support namespace'),
  ('support-tamtam', 'support', true, 'seed_v1', 'Brand impersonation support namespace'),
  ('tamtam_help', 'support', true, 'seed_v1', 'Brand impersonation support namespace'),
  ('tamtam-help', 'support', true, 'seed_v1', 'Brand impersonation support namespace'),
  ('help_tamtam', 'support', true, 'seed_v1', 'Brand impersonation support namespace'),
  ('help-tamtam', 'support', true, 'seed_v1', 'Brand impersonation support namespace'),
  ('tamtam_helpdesk', 'support', true, 'seed_v1', 'Brand impersonation support namespace'),
  ('tamtam-helpdesk', 'support', true, 'seed_v1', 'Brand impersonation support namespace'),
  ('travelflow', 'brand', true, 'seed_v1', 'Brand namespace'),
  ('travelflowapp', 'brand', true, 'seed_v1', 'Brand namespace'),
  ('travelplanner', 'brand', true, 'seed_v1', 'Brand namespace'),
  ('tripplanner', 'brand', true, 'seed_v1', 'Brand namespace')
on conflict ((lower(handle)))
do update
set
  category = excluded.category,
  owner_assignable = excluded.owner_assignable,
  source = excluded.source,
  notes = excluded.notes,
  active = true,
  updated_at = now();

insert into public.username_blocked_terms (term, category, severity, source, notes)
values
  ('airdrop', 'scam', 3, 'seed_v1', 'Crypto scam keyword'),
  ('giveaway', 'scam', 3, 'seed_v1', 'Giveaway impersonation keyword'),
  ('bitcoin', 'scam', 3, 'seed_v1', 'Crypto scam keyword'),
  ('ethereum', 'scam', 3, 'seed_v1', 'Crypto scam keyword'),
  ('nft', 'scam', 3, 'seed_v1', 'Crypto scam keyword'),
  ('token', 'scam', 3, 'seed_v1', 'Crypto scam keyword'),
  ('wallet', 'scam', 3, 'seed_v1', 'Credential/financial scam keyword'),
  ('metamask', 'scam', 3, 'seed_v1', 'Credential/financial scam keyword'),
  ('coinbase', 'scam', 3, 'seed_v1', 'Credential/financial scam keyword'),
  ('binance', 'scam', 3, 'seed_v1', 'Credential/financial scam keyword'),
  ('recovery', 'scam', 3, 'seed_v1', 'Credential recovery impersonation keyword'),
  ('otp', 'scam', 3, 'seed_v1', 'Credential recovery impersonation keyword'),
  ('2fa', 'scam', 3, 'seed_v1', 'Credential recovery impersonation keyword'),
  ('mfa', 'scam', 3, 'seed_v1', 'Credential recovery impersonation keyword'),
  ('escrow', 'scam', 3, 'seed_v1', 'Financial scam keyword'),
  ('investment', 'scam', 3, 'seed_v1', 'Financial scam keyword'),
  ('freemoney', 'scam', 3, 'seed_v1', 'Financial scam keyword'),
  ('doubling', 'scam', 3, 'seed_v1', 'Financial scam keyword'),
  ('nigger', 'hate_speech', 5, 'seed_v1', 'Racial slur'),
  ('nigga', 'hate_speech', 5, 'seed_v1', 'Racial slur'),
  ('chink', 'hate_speech', 5, 'seed_v1', 'Racial slur'),
  ('gook', 'hate_speech', 5, 'seed_v1', 'Racial slur'),
  ('spic', 'hate_speech', 5, 'seed_v1', 'Racial slur'),
  ('wetback', 'hate_speech', 5, 'seed_v1', 'Racial slur'),
  ('kike', 'hate_speech', 5, 'seed_v1', 'Racial slur'),
  ('paki', 'hate_speech', 5, 'seed_v1', 'Racial slur'),
  ('faggot', 'hate_speech', 5, 'seed_v1', 'LGBTQ+ slur'),
  ('tranny', 'hate_speech', 5, 'seed_v1', 'LGBTQ+ slur'),
  ('retard', 'hate_speech', 5, 'seed_v1', 'Ableist slur'),
  ('kkk', 'hate_speech', 5, 'seed_v1', 'Extremist hate abbreviation'),
  ('neonazi', 'hate_speech', 5, 'seed_v1', 'Extremist hate keyword'),
  ('hitler', 'hate_speech', 5, 'seed_v1', 'Extremist hate keyword'),
  ('siegheil', 'hate_speech', 5, 'seed_v1', 'Extremist hate slogan')
on conflict ((lower(term)))
do update
set
  category = excluded.category,
  severity = excluded.severity,
  source = excluded.source,
  notes = excluded.notes,
  active = true,
  updated_at = now();

alter table public.profile_handle_redirects enable row level security;

drop policy if exists "Profile handle redirects active read" on public.profile_handle_redirects;
create policy "Profile handle redirects active read"
on public.profile_handle_redirects for select
using (expires_at > now());

drop policy if exists "Profile handle redirects admin manage" on public.profile_handle_redirects;
create policy "Profile handle redirects admin manage"
on public.profile_handle_redirects for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Profiles are publicly readable when enabled" on public.profiles;
create policy "Profiles are publicly readable when enabled"
on public.profiles for select
using (
  coalesce(public_profile_enabled, true) = true
  and coalesce(account_status, 'active') = 'active'
);

drop policy if exists "Trips are publicly readable when profile is public" on public.trips;
create policy "Trips are publicly readable when profile is public"
on public.trips for select
using (
  coalesce(show_on_public_profile, true) = true
  and coalesce(status, 'active') <> 'archived'
  and exists (
    select 1
    from public.profiles p
    where p.id = trips.owner_id
      and coalesce(p.public_profile_enabled, true) = true
      and coalesce(p.account_status, 'active') = 'active'
  )
);

create or replace function public.profile_apply_username_rules()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_now timestamptz := now();
  v_old_username text := null;
  v_raw_display text := nullif(regexp_replace(btrim(coalesce(new.username_display, new.username, '')), '^@+', ''), '');
  v_new_username text := case
    when v_raw_display is null then null
    else lower(v_raw_display)
  end;
  v_is_self boolean := auth.uid() = coalesce(case when tg_op = 'INSERT' then new.id else old.id end, new.id);
  v_is_admin boolean := public.is_admin(auth.uid());
  v_bypass_cooldown boolean := coalesce(current_setting('app.username_cooldown_bypass', true), 'false') = 'true';
  v_reserved_bypass boolean := coalesce(current_setting('app.username_reserved_bypass', true), 'false') = 'true';
  v_reserved_owner_assignable boolean := false;
  v_cooldown_ends_at timestamptz;
begin
  if tg_op <> 'INSERT' then
    v_old_username := nullif(lower(btrim(coalesce(old.username, ''))), '');
  end if;

  if v_new_username is not null then
    if v_raw_display !~ '^[A-Za-z0-9_-]{3,40}$' then
      raise exception 'Username must be 3-40 chars and use only letters, numbers, underscores, or hyphens';
    end if;

    if v_new_username !~ '^[a-z0-9_-]{3,40}$' then
      raise exception 'Username must be 3-40 chars and use only letters, numbers, underscores, or hyphens';
    end if;

    if v_new_username !~ '[a-z0-9]' then
      raise exception 'Username must include at least one letter or number';
    end if;

    select coalesce(urh.owner_assignable, false)
      into v_reserved_owner_assignable
      from public.username_reserved_handles urh
     where lower(urh.handle) = v_new_username
       and urh.active = true
     limit 1;

    if found and not (
      v_is_admin
      and v_reserved_bypass
      and v_reserved_owner_assignable
    ) then
      raise exception 'Username is reserved';
    end if;

    if exists (
      select 1
      from public.username_blocked_terms ubt
      where lower(v_new_username) ~ ('(^|[-_])' || lower(ubt.term) || '($|[-_])')
        and ubt.active = true
    ) then
      raise exception 'Username is blocked';
    end if;

    if v_new_username in (
      'admin','administrator','admins','owner','team','staff',
      'moderator','mod',
      'support','help','helpdesk','help-desk','helpcenter','help-center',
      'supportteam','support-team','customersupport','customer-support',
      'service',
      'security','safety','trust','trustandsafety','trust-safety','compliance',
      'official','officialteam','official-team','verification','verify','verified',
      'adminsupport','admin-support',
      'system','noreply','no-reply','status','statuspage',
      'billing','payments','refund',
      'settings','profile','profiles','account','accounts',
      'login','logout','signup','signin','register','auth','oauth',
      'api','www','about','contact','careers','jobs','blog',
      'trip','trips','create',
      'privacy','terms','cookies','imprint',
      'tamtam','tamtamapp',
      'tamtam_admin','tamtam-admin','admin_tamtam','admin-tamtam',
      'tamtam_support','tamtam-support','support_tamtam','support-tamtam',
      'tamtam_help','tamtam-help','help_tamtam','help-tamtam',
      'tamtam_helpdesk','tamtam-helpdesk',
      'travelflow','travelflowapp','travelplanner','tripplanner'
    ) and not (v_is_admin and v_reserved_bypass) then
      raise exception 'Username is reserved';
    end if;
  end if;

  new.username := v_new_username;
  new.username_display := v_raw_display;

  if tg_op = 'INSERT' then
    if v_new_username is not null and new.username_changed_at is null then
      new.username_changed_at := v_now;
    end if;
    return new;
  end if;

  if coalesce(v_old_username, '') = coalesce(v_new_username, '') then
    return new;
  end if;

  if v_is_self and not v_is_admin and not v_bypass_cooldown and v_old_username is not null and old.username_changed_at is not null then
    v_cooldown_ends_at := old.username_changed_at + interval '90 days';
    if v_now < v_cooldown_ends_at then
      raise exception 'Username can only be changed every 90 days';
    end if;
  end if;

  if v_old_username is not null then
    insert into public.profile_handle_redirects (handle, user_id, expires_at, created_at, updated_at)
    values (v_old_username, old.id, v_now + interval '180 days', v_now, v_now)
    on conflict ((lower(handle)))
    do update
      set user_id = excluded.user_id,
          expires_at = excluded.expires_at,
          updated_at = v_now;
  end if;

  if v_new_username is not null then
    delete from public.profile_handle_redirects phr where lower(phr.handle) = v_new_username;
    new.username_changed_at := v_now;
  end if;

  return new;
end;
$$;

drop trigger if exists profile_apply_username_rules on public.profiles;
create trigger profile_apply_username_rules
before insert or update of username, username_display
on public.profiles
for each row execute function public.profile_apply_username_rules();

create or replace function public.profile_log_user_changes()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := auth.uid();
  v_source text := nullif(current_setting('app.profile_update_source', true), '');
  v_before jsonb;
  v_after jsonb;
  v_changed_fields jsonb;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if v_actor is null or v_actor <> new.id then
    return new;
  end if;

  v_before := jsonb_build_object(
    'display_name', old.display_name,
    'first_name', old.first_name,
    'last_name', old.last_name,
    'username', old.username,
    'bio', old.bio,
    'gender', old.gender,
    'country', old.country,
    'city', old.city,
    'preferred_language', old.preferred_language,
    'public_profile_enabled', old.public_profile_enabled,
    'default_public_trip_visibility', old.default_public_trip_visibility
  );

  v_after := jsonb_build_object(
    'display_name', new.display_name,
    'first_name', new.first_name,
    'last_name', new.last_name,
    'username', new.username,
    'bio', new.bio,
    'gender', new.gender,
    'country', new.country,
    'city', new.city,
    'preferred_language', new.preferred_language,
    'public_profile_enabled', new.public_profile_enabled,
    'default_public_trip_visibility', new.default_public_trip_visibility
  );

  if v_before = v_after then
    return new;
  end if;

  select coalesce(jsonb_agg(changed.key), '[]'::jsonb)
    into v_changed_fields
    from (
      select key
      from jsonb_each(v_after)
      where (v_before -> key) is distinct from (v_after -> key)
      order by key
    ) changed;

  insert into public.profile_user_events (
    owner_id,
    action,
    source,
    before_data,
    after_data,
    metadata
  )
  values (
    new.id,
    'profile.updated',
    coalesce(v_source, 'profile.settings'),
    v_before,
    v_after,
    jsonb_build_object('changed_fields', v_changed_fields)
  );

  return new;
end;
$$;

drop trigger if exists profile_log_user_changes on public.profiles;
create trigger profile_log_user_changes
after update on public.profiles
for each row execute function public.profile_log_user_changes();

drop function if exists public.profile_check_username_availability(text);
drop function if exists public.profile_check_username_availability(text, boolean);
create or replace function public.profile_check_username_availability(
  p_username text,
  p_log_attempt boolean default false
)
returns table(
  availability text,
  reason text,
  cooldown_ends_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_username text := nullif(lower(btrim(coalesce(p_username, ''))), '');
  v_uid uuid := auth.uid();
  v_current_username text;
  v_username_changed_at timestamptz;
  v_cooldown_ends_at timestamptz;
  v_log_reason text;
begin
  if v_username is null then
    v_log_reason := 'empty';
    if p_log_attempt and v_uid is not null then
      insert into public.profile_user_events (owner_id, action, source, metadata)
      values (
        v_uid,
        'profile.username_change_blocked',
        'profile.username.validation',
        jsonb_build_object('username_candidate', coalesce(p_username, ''), 'canonical_candidate', v_username, 'reason', v_log_reason)
      );
    end if;
    return query select 'invalid'::text, 'empty'::text, null::timestamptz;
    return;
  end if;

  if v_username !~ '^[a-z0-9_-]{3,40}$' then
    v_log_reason := 'format';
    if p_log_attempt and v_uid is not null then
      insert into public.profile_user_events (owner_id, action, source, metadata)
      values (
        v_uid,
        'profile.username_change_blocked',
        'profile.username.validation',
        jsonb_build_object('username_candidate', coalesce(p_username, ''), 'canonical_candidate', v_username, 'reason', v_log_reason)
      );
    end if;
    return query select 'invalid'::text, 'format'::text, null::timestamptz;
    return;
  end if;

  if v_username !~ '[a-z0-9]' then
    v_log_reason := 'format';
    if p_log_attempt and v_uid is not null then
      insert into public.profile_user_events (owner_id, action, source, metadata)
      values (
        v_uid,
        'profile.username_change_blocked',
        'profile.username.validation',
        jsonb_build_object('username_candidate', coalesce(p_username, ''), 'canonical_candidate', v_username, 'reason', v_log_reason)
      );
    end if;
    return query select 'invalid'::text, 'format'::text, null::timestamptz;
    return;
  end if;

  if exists (
    select 1
    from public.username_reserved_handles urh
    where lower(urh.handle) = v_username
      and urh.active = true
  ) then
    v_log_reason := 'reserved';
    if p_log_attempt and v_uid is not null then
      insert into public.profile_user_events (owner_id, action, source, metadata)
      values (
        v_uid,
        'profile.username_change_blocked',
        'profile.username.validation',
        jsonb_build_object('username_candidate', coalesce(p_username, ''), 'canonical_candidate', v_username, 'reason', v_log_reason)
      );
    end if;
    return query select 'reserved'::text, 'reserved'::text, null::timestamptz;
    return;
  end if;

  if exists (
    select 1
    from public.username_blocked_terms ubt
    where lower(v_username) ~ ('(^|[-_])' || lower(ubt.term) || '($|[-_])')
      and ubt.active = true
  ) then
    v_log_reason := 'blocked';
    if p_log_attempt and v_uid is not null then
      insert into public.profile_user_events (owner_id, action, source, metadata)
      values (
        v_uid,
        'profile.username_change_blocked',
        'profile.username.validation',
        jsonb_build_object('username_candidate', coalesce(p_username, ''), 'canonical_candidate', v_username, 'reason', v_log_reason)
      );
    end if;
    return query select 'reserved'::text, 'blocked'::text, null::timestamptz;
    return;
  end if;

  if v_username in (
    'admin','administrator','admins','owner','team','staff',
    'moderator','mod',
    'support','help','helpdesk','help-desk','helpcenter','help-center',
    'supportteam','support-team','customersupport','customer-support',
    'service',
    'security','safety','trust','trustandsafety','trust-safety','compliance',
    'official','officialteam','official-team','verification','verify','verified',
    'adminsupport','admin-support',
    'system','noreply','no-reply','status','statuspage',
    'billing','payments','refund',
    'settings','profile','profiles','account','accounts',
    'login','logout','signup','signin','register','auth','oauth',
    'api','www','about','contact','careers','jobs','blog',
    'trip','trips','create',
    'privacy','terms','cookies','imprint',
    'tamtam','tamtamapp',
    'tamtam_admin','tamtam-admin','admin_tamtam','admin-tamtam',
    'tamtam_support','tamtam-support','support_tamtam','support-tamtam',
    'tamtam_help','tamtam-help','help_tamtam','help-tamtam',
    'tamtam_helpdesk','tamtam-helpdesk',
    'travelflow','travelflowapp','travelplanner','tripplanner'
  ) then
    v_log_reason := 'reserved';
    if p_log_attempt and v_uid is not null then
      insert into public.profile_user_events (owner_id, action, source, metadata)
      values (
        v_uid,
        'profile.username_change_blocked',
        'profile.username.validation',
        jsonb_build_object('username_candidate', coalesce(p_username, ''), 'canonical_candidate', v_username, 'reason', v_log_reason)
      );
    end if;
    return query select 'reserved'::text, 'reserved'::text, null::timestamptz;
    return;
  end if;

  if v_uid is not null then
    select nullif(lower(btrim(coalesce(p.username, ''))), ''), p.username_changed_at
      into v_current_username, v_username_changed_at
      from public.profiles p
     where p.id = v_uid
     limit 1;

    if v_current_username is not null and v_current_username = v_username then
      return query select 'unchanged'::text, null::text, null::timestamptz;
      return;
    end if;

    if v_current_username is not null and v_username_changed_at is not null and not public.is_admin(v_uid) then
      v_cooldown_ends_at := v_username_changed_at + interval '90 days';
      if now() < v_cooldown_ends_at then
        if p_log_attempt then
          insert into public.profile_user_events (owner_id, action, source, metadata)
          values (
            v_uid,
            'profile.username_change_blocked',
            'profile.username.validation',
            jsonb_build_object(
              'username_candidate', coalesce(p_username, ''),
              'canonical_candidate', v_username,
              'reason', 'cooldown',
              'cooldown_ends_at', v_cooldown_ends_at
            )
          );
        end if;
        return query select 'cooldown'::text, 'cooldown'::text, v_cooldown_ends_at;
        return;
      end if;
    end if;
  end if;

  if exists (
    select 1
    from public.profiles p
    where lower(coalesce(p.username, '')) = v_username
      and (v_uid is null or p.id <> v_uid)
  ) then
    v_log_reason := 'taken';
    if p_log_attempt and v_uid is not null then
      insert into public.profile_user_events (owner_id, action, source, metadata)
      values (
        v_uid,
        'profile.username_change_blocked',
        'profile.username.validation',
        jsonb_build_object('username_candidate', coalesce(p_username, ''), 'canonical_candidate', v_username, 'reason', v_log_reason)
      );
    end if;
    return query select 'taken'::text, null::text, null::timestamptz;
    return;
  end if;

  if exists (
    select 1
    from public.profile_handle_redirects phr
    where lower(phr.handle) = v_username
      and phr.expires_at > now()
      and (v_uid is null or phr.user_id <> v_uid)
  ) then
    v_log_reason := 'redirect_reserved';
    if p_log_attempt and v_uid is not null then
      insert into public.profile_user_events (owner_id, action, source, metadata)
      values (
        v_uid,
        'profile.username_change_blocked',
        'profile.username.validation',
        jsonb_build_object('username_candidate', coalesce(p_username, ''), 'canonical_candidate', v_username, 'reason', v_log_reason)
      );
    end if;
    return query select 'reserved'::text, 'redirect_reserved'::text, null::timestamptz;
    return;
  end if;

  return query select 'available'::text, null::text, null::timestamptz;
end;
$$;

drop function if exists public.profile_resolve_public_handle(text);
create or replace function public.profile_resolve_public_handle(p_handle text)
returns table(
  status text,
  canonical_username text,
  id uuid,
  display_name text,
  first_name text,
  last_name text,
  username text,
  username_display text,
  bio text,
  country text,
  city text,
  preferred_language text,
  public_profile_enabled boolean,
  account_status text,
  username_changed_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_handle text := nullif(lower(btrim(coalesce(p_handle, ''))), '');
  v_redirect_user_id uuid;
begin
  if v_handle is null or v_handle !~ '^[a-z0-9_-]{3,40}$' then
    return query select 'not_found'::text, null::text, null::uuid, null::text, null::text, null::text, null::text, null::text, null::text, null::text, null::text, null::text, null::boolean, null::text, null::timestamptz;
    return;
  end if;

  return query
  select
    case
      when coalesce(p.public_profile_enabled, true) = true and coalesce(p.account_status, 'active') = 'active' then 'found'
      else 'private'
    end as status,
    p.username as canonical_username,
    p.id,
    p.display_name,
    p.first_name,
    p.last_name,
    p.username,
    p.username_display,
    p.bio,
    p.country,
    p.city,
    p.preferred_language,
    p.public_profile_enabled,
    p.account_status,
    p.username_changed_at
  from public.profiles p
  where lower(coalesce(p.username, '')) = v_handle
  limit 1;

  if found then
    return;
  end if;

  select phr.user_id
    into v_redirect_user_id
    from public.profile_handle_redirects phr
   where lower(phr.handle) = v_handle
     and phr.expires_at > now()
   order by phr.expires_at desc
   limit 1;

  if v_redirect_user_id is null then
    return query select 'not_found'::text, null::text, null::uuid, null::text, null::text, null::text, null::text, null::text, null::text, null::text, null::text, null::text, null::boolean, null::text, null::timestamptz;
    return;
  end if;

  return query
  select
    case
      when coalesce(p.public_profile_enabled, true) = true and coalesce(p.account_status, 'active') = 'active' then 'redirect'
      else 'private'
    end as status,
    p.username as canonical_username,
    p.id,
    p.display_name,
    p.first_name,
    p.last_name,
    p.username,
    p.username_display,
    p.bio,
    p.country,
    p.city,
    p.preferred_language,
    p.public_profile_enabled,
    p.account_status,
    p.username_changed_at
  from public.profiles p
  where p.id = v_redirect_user_id
  limit 1;

  if not found then
    return query select 'not_found'::text, null::text, null::uuid, null::text, null::text, null::text, null::text, null::text, null::text, null::text, null::text, null::text, null::boolean, null::text, null::timestamptz;
  end if;
end;
$$;

create or replace function public.upsert_trip(
  p_id text,
  p_data jsonb,
  p_view jsonb,
  p_title text,
  p_start_date date,
  p_is_favorite boolean,
  p_show_on_public_profile boolean default true,
  p_forked_from_trip_id text default null,
  p_forked_from_share_token text default null,
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
  v_source text;
  v_status_before text;
  v_status_after text;
  v_title_before text;
  v_title_after text;
  v_visibility_before boolean;
  v_visibility_after boolean;
  v_trip_expires_before timestamptz;
  v_trip_expires_after timestamptz;
  v_source_kind_before text;
  v_source_kind_after text;
begin
  v_owner := auth.uid();
  if v_owner is null then
    raise exception 'Not authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('trip-upsert:' || coalesce(p_id, ''), 0));

  v_source := nullif(current_setting('app.trip_update_source', true), '');

  v_status := case
    when p_status in ('active', 'archived', 'expired') then p_status
    else 'active'
  end;

  if exists (select 1 from public.trips t where t.id = p_id) then
    if not exists (select 1 from public.trips t where t.id = p_id and t.owner_id = v_owner) then
      raise exception 'Not allowed';
    end if;

    select
      t.status,
      t.title,
      t.show_on_public_profile,
      t.trip_expires_at,
      t.source_kind
      into v_status_before, v_title_before, v_visibility_before, v_trip_expires_before, v_source_kind_before
      from public.trips t
     where t.id = p_id
       and t.owner_id = v_owner
     limit 1;

    update public.trips
       set data = p_data,
           view_settings = p_view,
           title = coalesce(p_title, title),
           start_date = coalesce(p_start_date, start_date),
           is_favorite = coalesce(p_is_favorite, is_favorite),
           show_on_public_profile = coalesce(p_show_on_public_profile, show_on_public_profile),
           forked_from_trip_id = coalesce(p_forked_from_trip_id, forked_from_trip_id),
           forked_from_share_token = coalesce(p_forked_from_share_token, forked_from_share_token),
           status = coalesce(v_status, status),
           trip_expires_at = coalesce(p_trip_expires_at, trip_expires_at),
           source_kind = coalesce(p_source_kind, source_kind),
           source_template_id = coalesce(p_source_template_id, source_template_id),
           updated_at = now()
     where id = p_id
     returning
       status,
       title,
       show_on_public_profile,
       trip_expires_at,
       source_kind
      into v_status_after, v_title_after, v_visibility_after, v_trip_expires_after, v_source_kind_after;

    if v_status_before is distinct from v_status_after
      or v_title_before is distinct from v_title_after
      or v_visibility_before is distinct from v_visibility_after
      or v_trip_expires_before is distinct from v_trip_expires_after
      or v_source_kind_before is distinct from v_source_kind_after then
      insert into public.trip_user_events (trip_id, owner_id, action, source, metadata)
      values (
        p_id,
        v_owner,
        'trip.updated',
        coalesce(v_source, p_source_kind, 'trip.editor'),
        jsonb_build_object(
          'trip_id', p_id,
          'status_before', v_status_before,
          'status_after', v_status_after,
          'title_before', v_title_before,
          'title_after', v_title_after,
          'show_on_public_profile_before', v_visibility_before,
          'show_on_public_profile_after', v_visibility_after,
          'trip_expires_at_before', v_trip_expires_before,
          'trip_expires_at_after', v_trip_expires_after,
          'source_kind_before', v_source_kind_before,
          'source_kind_after', v_source_kind_after
        )
      );
    end if;
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
      show_on_public_profile,
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
      coalesce(p_show_on_public_profile, true),
      v_status,
      v_trip_expires_at,
      p_source_kind,
      p_source_template_id,
      p_forked_from_trip_id,
      p_forked_from_share_token
    )
    returning
      status,
      title,
      show_on_public_profile,
      trip_expires_at,
      source_kind
      into v_status_after, v_title_after, v_visibility_after, v_trip_expires_after, v_source_kind_after;

    insert into public.trip_user_events (trip_id, owner_id, action, source, metadata)
    values (
      p_id,
      v_owner,
      'trip.created',
      coalesce(v_source, p_source_kind, 'trip.editor'),
      jsonb_build_object(
        'trip_id', p_id,
        'status_after', v_status_after,
        'title_after', v_title_after,
        'show_on_public_profile_after', v_visibility_after,
        'trip_expires_at_after', v_trip_expires_after,
        'source_kind_after', v_source_kind_after
      )
    );
  end if;

  return query select p_id as trip_id;
end;
$$;

create or replace function public.archive_trip_for_user(
  p_trip_id text,
  p_source text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(
  trip_id text,
  status text,
  archived_at timestamptz,
  event_id uuid
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_owner uuid;
  v_trip_row public.trips%rowtype;
  v_event_id uuid;
  v_label text;
  v_status_before text;
begin
  v_owner := auth.uid();
  if v_owner is null then
    raise exception 'Not authenticated';
  end if;

  select t.*
    into v_trip_row
    from public.trips t
   where t.id = p_trip_id
     and t.owner_id = v_owner
   limit 1;

  if v_trip_row.id is null then
    insert into public.profile_user_events (
      owner_id,
      action,
      source,
      before_data,
      after_data,
      metadata
    )
    values (
      v_owner,
      'trip.archive_failed',
      nullif(btrim(coalesce(p_source, '')), ''),
      '{}'::jsonb,
      '{}'::jsonb,
      coalesce(p_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'trip_id', p_trip_id,
          'reason', 'not_owned_or_missing'
        )
    );
    raise exception 'Trip not found or not owned by current user';
  end if;

  v_status_before := coalesce(v_trip_row.status, 'active');

  update public.trips t
     set status = 'archived',
         archived_at = coalesce(t.archived_at, now()),
         updated_at = now()
   where t.id = p_trip_id
   returning t.* into v_trip_row;

  v_label := 'Archived by user';
  if nullif(btrim(coalesce(p_source, '')), '') is not null then
    v_label := format('Archived by user (%s)', btrim(p_source));
  end if;

  insert into public.trip_versions (trip_id, data, view_settings, label, created_by)
  values (v_trip_row.id, v_trip_row.data, v_trip_row.view_settings, v_label, v_owner);

  insert into public.trip_user_events (trip_id, owner_id, action, source, metadata)
  values (
    v_trip_row.id,
    v_owner,
    'trip.archived',
    nullif(btrim(coalesce(p_source, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'trip_id', v_trip_row.id,
        'status_before', v_status_before,
        'status_after', 'archived'
      )
  )
  returning id into v_event_id;

  return query
  select
    v_trip_row.id,
    'archived'::text,
    v_trip_row.archived_at,
    v_event_id;
end;
$$;

create or replace function public.log_user_action_failure(
  p_action text,
  p_target_type text default 'unknown',
  p_target_id text default null,
  p_source text default null,
  p_error_code text default null,
  p_error_message text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_owner uuid;
  v_event_id uuid;
begin
  v_owner := auth.uid();
  if v_owner is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profile_user_events (
    owner_id,
    action,
    source,
    before_data,
    after_data,
    metadata
  )
  values (
    v_owner,
    coalesce(nullif(btrim(coalesce(p_action, '')), ''), 'user.action_failed'),
    nullif(btrim(coalesce(p_source, '')), ''),
    '{}'::jsonb,
    '{}'::jsonb,
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'target_type', coalesce(nullif(btrim(coalesce(p_target_type, '')), ''), 'unknown'),
        'target_id', nullif(btrim(coalesce(p_target_id, '')), ''),
        'error_code', nullif(btrim(coalesce(p_error_code, '')), ''),
        'error_message', nullif(btrim(coalesce(p_error_message, '')), '')
      )
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

grant execute on function public.profile_check_username_availability(text, boolean) to anon, authenticated;
grant execute on function public.profile_resolve_public_handle(text) to anon, authenticated;
grant execute on function public.upsert_trip(text, jsonb, jsonb, text, date, boolean, boolean, text, text, text, timestamptz, text, text) to anon, authenticated;
grant execute on function public.archive_trip_for_user(text, text, jsonb) to authenticated;
grant execute on function public.log_user_action_failure(text, text, text, text, text, text, jsonb) to authenticated;

-- Existing-project compatibility adjustments for function search_path and stricter authenticated policies.
alter function public.resolve_default_entitlements(text) set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.set_trip_version_number() set search_path = public;

alter table public.username_blocked_terms enable row level security;
drop policy if exists "Username blocked terms admin manage" on public.username_blocked_terms;
create policy "Username blocked terms admin manage"
on public.username_blocked_terms
for all
to authenticated
using (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and public.is_admin(auth.uid())
)
with check (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and public.is_admin(auth.uid())
);

alter table public.username_reserved_handles enable row level security;
drop policy if exists "Username reserved handles admin manage" on public.username_reserved_handles;
create policy "Username reserved handles admin manage"
on public.username_reserved_handles
for all
to authenticated
using (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and public.is_admin(auth.uid())
)
with check (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and public.is_admin(auth.uid())
);

alter policy "Admin allowlist admin manage"
on public.admin_allowlist
to authenticated
using (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and public.is_admin(auth.uid())
)
with check (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and public.is_admin(auth.uid())
);

alter policy "Auth flow logs admin read"
on public.auth_flow_logs
to authenticated
using (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and public.is_admin(auth.uid())
);

alter policy "Admin roles admin read"
on public.admin_roles
to authenticated
using (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and public.is_admin(auth.uid())
);

alter policy "Admin permissions admin read"
on public.admin_permissions
to authenticated
using (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and public.is_admin(auth.uid())
);

alter policy "Admin role permissions admin read"
on public.admin_role_permissions
to authenticated
using (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and public.is_admin(auth.uid())
);

alter policy "Admin user roles admin read"
on public.admin_user_roles
to authenticated
using (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and public.is_admin(auth.uid())
);

alter policy "Admin user roles admin manage"
on public.admin_user_roles
to authenticated
using (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and public.is_admin(auth.uid())
)
with check (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and public.is_admin(auth.uid())
);

alter policy "Admin audit logs admin read"
on public.admin_audit_logs
to authenticated
using (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and public.is_admin(auth.uid())
);

alter policy "User settings are user-owned"
on public.user_settings
to authenticated
using (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and user_id = auth.uid()
)
with check (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and user_id = auth.uid()
);

alter policy "Subscriptions are user-owned"
on public.subscriptions
to authenticated
using (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and user_id = auth.uid()
)
with check (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and user_id = auth.uid()
);

alter policy "Legal terms acceptance owner read"
on public.legal_terms_acceptance_events
to authenticated
using (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and (user_id = auth.uid() or public.is_admin(auth.uid()))
);

alter policy "Profile user events owner read"
on public.profile_user_events
to authenticated
using (
  not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  and (owner_id = auth.uid() or public.is_admin(auth.uid()))
);

-- =============================================================================
-- Airport reference + nearby-airports foundation
-- =============================================================================

create table if not exists public.airports_reference (
  ident text primary key,
  iata_code text,
  icao_code text,
  name text not null,
  municipality text,
  subdivision_name text,
  region_code text,
  country_code text not null,
  country_name text not null,
  latitude double precision not null,
  longitude double precision not null,
  timezone text,
  airport_type text not null,
  scheduled_service boolean not null default false,
  is_commercial boolean not null default false,
  commercial_service_tier text not null default 'local',
  is_major_commercial boolean not null default false
);

alter table public.airports_reference add column if not exists commercial_service_tier text not null default 'local';
alter table public.airports_reference add column if not exists is_major_commercial boolean not null default false;

create index if not exists airports_reference_commercial_idx on public.airports_reference (is_commercial);
create index if not exists airports_reference_iata_idx on public.airports_reference (iata_code);
create index if not exists airports_reference_icao_idx on public.airports_reference (icao_code);
create index if not exists airports_reference_country_idx on public.airports_reference (country_code);
create index if not exists airports_reference_service_tier_idx on public.airports_reference (commercial_service_tier);
create index if not exists airports_reference_major_commercial_idx on public.airports_reference (is_major_commercial);

create table if not exists public.airports_reference_metadata (
  id text primary key,
  data_version text not null,
  generated_at timestamptz not null,
  commercial_airport_count integer not null,
  source_airport_count integer not null,
  sources jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  synced_by text
);

alter table public.airports_reference enable row level security;
alter table public.airports_reference_metadata enable row level security;

drop policy if exists "Airports reference public read" on public.airports_reference;
create policy "Airports reference public read"
on public.airports_reference for select
using (true);

drop policy if exists "Airports reference metadata public read" on public.airports_reference_metadata;
create policy "Airports reference metadata public read"
on public.airports_reference_metadata for select
using (true);

drop function if exists public.find_nearest_commercial_airports(double precision, double precision, integer);
create or replace function public.find_nearest_commercial_airports(
  p_lat double precision,
  p_lng double precision,
  p_limit integer default 10,
  p_min_service_tier text default 'major'
)
returns table(
  ident text,
  iata_code text,
  icao_code text,
  name text,
  municipality text,
  subdivision_name text,
  region_code text,
  country_code text,
  country_name text,
  latitude double precision,
  longitude double precision,
  timezone text,
  airport_type text,
  scheduled_service boolean,
  is_commercial boolean,
  commercial_service_tier text,
  is_major_commercial boolean,
  air_distance_km double precision
)
language sql
stable
set search_path = public
as $$
  with limited_airports as (
    select
      ar.ident,
      ar.iata_code,
      ar.icao_code,
      ar.name,
      ar.municipality,
      ar.subdivision_name,
      ar.region_code,
      ar.country_code,
      ar.country_name,
      ar.latitude,
      ar.longitude,
      ar.timezone,
      ar.airport_type,
      ar.scheduled_service,
      ar.is_commercial,
      ar.commercial_service_tier,
      ar.is_major_commercial,
      6371::double precision * acos(
        least(
          1::double precision,
          greatest(
            -1::double precision,
            cos(radians(p_lat)) * cos(radians(ar.latitude)) * cos(radians(ar.longitude) - radians(p_lng))
            + sin(radians(p_lat)) * sin(radians(ar.latitude))
          )
        )
      ) as air_distance_km
    from public.airports_reference ar
    where ar.is_commercial = true
      and (
        case coalesce(p_min_service_tier, 'major')
          when 'major' then ar.commercial_service_tier = 'major'
          when 'regional' then ar.commercial_service_tier in ('regional', 'major')
          else ar.commercial_service_tier in ('local', 'regional', 'major')
        end
      )
      and p_lat between -90 and 90
      and p_lng between -180 and 180
  )
  select
    limited_airports.ident,
    limited_airports.iata_code,
    limited_airports.icao_code,
    limited_airports.name,
    limited_airports.municipality,
    limited_airports.subdivision_name,
    limited_airports.region_code,
    limited_airports.country_code,
    limited_airports.country_name,
    limited_airports.latitude,
    limited_airports.longitude,
    limited_airports.timezone,
    limited_airports.airport_type,
    limited_airports.scheduled_service,
    limited_airports.is_commercial,
    limited_airports.commercial_service_tier,
    limited_airports.is_major_commercial,
    limited_airports.air_distance_km
  from limited_airports
  order by limited_airports.air_distance_km asc,
           coalesce(limited_airports.iata_code, limited_airports.icao_code, limited_airports.ident) asc,
           limited_airports.name asc,
           limited_airports.ident asc
  limit least(greatest(coalesce(p_limit, 10), 1), 10);
$$;

grant execute on function public.find_nearest_commercial_airports(double precision, double precision, integer, text) to anon, authenticated;

drop function if exists public.admin_replace_airports_reference(jsonb, jsonb, text);
create or replace function public.admin_replace_airports_reference(
  p_rows jsonb,
  p_metadata jsonb,
  p_synced_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request_role text := coalesce(auth.role(), '');
  v_row_count integer := 0;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Airport rows payload must be a JSON array.';
  end if;

  if jsonb_typeof(p_metadata) is distinct from 'object' then
    raise exception 'Airport metadata payload must be a JSON object.';
  end if;

  if v_request_role <> 'service_role' and not public.is_admin(v_uid) then
    raise exception 'Admin access required.';
  end if;

  delete from public.airports_reference;

  insert into public.airports_reference (
    ident,
    iata_code,
    icao_code,
    name,
    municipality,
    subdivision_name,
    region_code,
    country_code,
    country_name,
    latitude,
    longitude,
    timezone,
    airport_type,
    scheduled_service,
    is_commercial,
    commercial_service_tier,
    is_major_commercial
  )
  select
    upper(trim(coalesce(row ->> 'ident', ''))),
    nullif(upper(trim(coalesce(row ->> 'iataCode', ''))), ''),
    nullif(upper(trim(coalesce(row ->> 'icaoCode', ''))), ''),
    trim(coalesce(row ->> 'name', '')),
    nullif(trim(coalesce(row ->> 'municipality', '')), ''),
    nullif(trim(coalesce(row ->> 'subdivisionName', '')), ''),
    nullif(upper(trim(coalesce(row ->> 'regionCode', ''))), ''),
    upper(trim(coalesce(row ->> 'countryCode', ''))),
    trim(coalesce(row ->> 'countryName', '')),
    (row ->> 'latitude')::double precision,
    (row ->> 'longitude')::double precision,
    nullif(trim(coalesce(row ->> 'timezone', '')), ''),
    case trim(coalesce(row ->> 'airportType', ''))
      when 'large_airport' then 'large_airport'
      when 'medium_airport' then 'medium_airport'
      else 'small_airport'
    end,
    lower(trim(coalesce(row ->> 'scheduledService', 'false'))) = 'true',
    lower(trim(coalesce(row ->> 'isCommercial', 'false'))) = 'true',
    case trim(coalesce(row ->> 'commercialServiceTier', ''))
      when 'major' then 'major'
      when 'regional' then 'regional'
      else 'local'
    end,
    lower(trim(coalesce(row ->> 'isMajorCommercial', 'false'))) = 'true'
  from jsonb_array_elements(p_rows) as row
  where trim(coalesce(row ->> 'ident', '')) <> ''
    and trim(coalesce(row ->> 'name', '')) <> ''
    and trim(coalesce(row ->> 'countryCode', '')) <> ''
    and trim(coalesce(row ->> 'countryName', '')) <> ''
    and trim(coalesce(row ->> 'latitude', '')) <> ''
    and trim(coalesce(row ->> 'longitude', '')) <> ''
  ;

  get diagnostics v_row_count = row_count;

  insert into public.airports_reference_metadata (
    id,
    data_version,
    generated_at,
    commercial_airport_count,
    source_airport_count,
    sources,
    synced_at,
    synced_by
  )
  values (
    'global',
    coalesce(nullif(trim(p_metadata ->> 'dataVersion'), ''), 'unknown'),
    coalesce(nullif(trim(p_metadata ->> 'generatedAt'), '')::timestamptz, now()),
    coalesce(nullif(trim(p_metadata ->> 'commercialAirportCount'), '')::integer, v_row_count),
    coalesce(nullif(trim(p_metadata ->> 'sourceAirportCount'), '')::integer, v_row_count),
    coalesce(p_metadata -> 'sources', '{}'::jsonb),
    now(),
    nullif(trim(coalesce(p_synced_by, '')), '')
  )
  on conflict (id) do update set
    data_version = excluded.data_version,
    generated_at = excluded.generated_at,
    commercial_airport_count = excluded.commercial_airport_count,
    source_airport_count = excluded.source_airport_count,
    sources = excluded.sources,
    synced_at = excluded.synced_at,
    synced_by = excluded.synced_by
  ;

  return jsonb_build_object(
    'rowCount', v_row_count,
    'dataVersion', coalesce(nullif(trim(p_metadata ->> 'dataVersion'), ''), 'unknown')
  );
end;
$$;

revoke all on function public.admin_replace_airports_reference(jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_replace_airports_reference(jsonb, jsonb, text) to service_role;

-- =============================================================================
-- Travel knowledge foundation (JourneySpec + Thailand-first destination packs)
-- =============================================================================

create table if not exists public.travel_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  name text not null,
  source_kind text not null,
  base_url text not null,
  terms_url text,
  license_key text,
  attribution_text text,
  commercial_use_allowed boolean not null default false,
  redistribution_allowed boolean not null default false,
  refresh_interval_days integer,
  status text not null default 'active',
  ingestion_mode text not null default 'manual_reference',
  automation_status text not null default 'manual_only',
  license_reviewed_at timestamptz,
  license_review_interval_days integer,
  raw_storage_policy text not null default 'metadata_only',
  allow_llm_processing boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_sources_key_format check (source_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint travel_sources_kind_check check (source_kind in ('official', 'open_data', 'commercial', 'editorial', 'community')),
  constraint travel_sources_status_check check (status in ('active', 'inactive', 'restricted')),
  constraint travel_sources_refresh_check check (refresh_interval_days is null or refresh_interval_days > 0),
  constraint travel_sources_ingestion_mode_check check (ingestion_mode in ('automated_bulk', 'automated_api', 'manual_reference', 'licensed_runtime', 'editorial')),
  constraint travel_sources_automation_status_check check (automation_status in ('active', 'planned', 'blocked_license', 'manual_only', 'runtime_only')),
  constraint travel_sources_license_review_interval_check check (license_review_interval_days is null or license_review_interval_days > 0),
  constraint travel_sources_raw_storage_policy_check check (raw_storage_policy in ('private_snapshot', 'metadata_only', 'prohibited', 'runtime_cache')),
  constraint travel_sources_metadata_object check (jsonb_typeof(metadata) = 'object')
);

alter table public.travel_sources add column if not exists ingestion_mode text not null default 'manual_reference';
alter table public.travel_sources add column if not exists automation_status text not null default 'manual_only';
alter table public.travel_sources add column if not exists license_reviewed_at timestamptz;
alter table public.travel_sources add column if not exists license_review_interval_days integer;
alter table public.travel_sources add column if not exists raw_storage_policy text not null default 'metadata_only';
alter table public.travel_sources add column if not exists allow_llm_processing boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'travel_sources_ingestion_mode_check') then
    alter table public.travel_sources add constraint travel_sources_ingestion_mode_check
      check (ingestion_mode in ('automated_bulk', 'automated_api', 'manual_reference', 'licensed_runtime', 'editorial'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'travel_sources_automation_status_check') then
    alter table public.travel_sources add constraint travel_sources_automation_status_check
      check (automation_status in ('active', 'planned', 'blocked_license', 'manual_only', 'runtime_only'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'travel_sources_license_review_interval_check') then
    alter table public.travel_sources add constraint travel_sources_license_review_interval_check
      check (license_review_interval_days is null or license_review_interval_days > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'travel_sources_raw_storage_policy_check') then
    alter table public.travel_sources add constraint travel_sources_raw_storage_policy_check
      check (raw_storage_policy in ('private_snapshot', 'metadata_only', 'prohibited', 'runtime_cache'));
  end if;
end
$$;

create table if not exists public.travel_dataset_versions (
  id uuid primary key default gen_random_uuid(),
  dataset_key text not null,
  country_code text not null,
  version text not null,
  status text not null default 'draft',
  checksum text not null,
  entity_count integer not null default 0,
  fact_count integer not null default 0,
  template_count integer not null default 0,
  source_snapshot jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null,
  published_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_dataset_versions_key_format check (dataset_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint travel_dataset_versions_country_code check (country_code ~ '^[A-Z]{2}$'),
  constraint travel_dataset_versions_status_check check (status in ('draft', 'published', 'retired')),
  constraint travel_dataset_versions_counts_check check (entity_count >= 0 and fact_count >= 0 and template_count >= 0),
  constraint travel_dataset_versions_snapshot_array check (jsonb_typeof(source_snapshot) = 'array'),
  unique (dataset_key, version)
);

create table if not exists public.travel_entities (
  id uuid primary key default gen_random_uuid(),
  canonical_slug text not null unique,
  entity_type text not null,
  parent_id uuid references public.travel_entities(id) on delete restrict,
  country_code text not null,
  primary_name text not null,
  local_name text,
  timezone text,
  latitude double precision,
  longitude double precision,
  geo_bounds jsonb,
  status text not null default 'draft',
  dataset_version text not null,
  typical_min_days numeric(5, 2),
  typical_max_days numeric(5, 2),
  popularity_score numeric(5, 2) not null default 0,
  hidden_gem_score numeric(5, 2) not null default 0,
  tourism_intensity_score numeric(5, 2) not null default 0,
  attributes jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_entities_slug_format check (canonical_slug ~ '^[a-z0-9][a-z0-9-]*$'),
  constraint travel_entities_type_check check (entity_type in ('country', 'region', 'city', 'neighborhood', 'poi', 'port', 'campground')),
  constraint travel_entities_country_code check (country_code ~ '^[A-Z]{2}$'),
  constraint travel_entities_status_check check (status in ('draft', 'published', 'archived')),
  constraint travel_entities_latitude_check check (latitude is null or latitude between -90 and 90),
  constraint travel_entities_longitude_check check (longitude is null or longitude between -180 and 180),
  constraint travel_entities_coordinates_pair check ((latitude is null) = (longitude is null)),
  constraint travel_entities_stay_range check (
    (typical_min_days is null or typical_min_days >= 0)
    and (typical_max_days is null or typical_max_days >= 0)
    and (typical_min_days is null or typical_max_days is null or typical_min_days <= typical_max_days)
  ),
  constraint travel_entities_scores_check check (
    popularity_score between 0 and 100
    and hidden_gem_score between 0 and 100
    and tourism_intensity_score between 0 and 100
  ),
  constraint travel_entities_no_self_parent check (parent_id is null or parent_id <> id),
  constraint travel_entities_bounds_object check (geo_bounds is null or jsonb_typeof(geo_bounds) = 'object'),
  constraint travel_entities_attributes_object check (jsonb_typeof(attributes) = 'object')
);

create table if not exists public.travel_entity_names (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.travel_entities(id) on delete cascade,
  locale text not null,
  name text not null,
  name_kind text not null default 'primary',
  is_preferred boolean not null default false,
  created_at timestamptz not null default now(),
  constraint travel_entity_names_locale_check check (locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]+)*$'),
  constraint travel_entity_names_kind_check check (name_kind in ('primary', 'local', 'alias', 'historic')),
  unique (entity_id, locale, name, name_kind)
);

create table if not exists public.travel_entity_facts (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.travel_entities(id) on delete cascade,
  fact_key text not null,
  value_json jsonb not null,
  unit text,
  locale text,
  source_id uuid not null references public.travel_sources(id) on delete restrict,
  confidence numeric(4, 3) not null default 0.8,
  review_status text not null default 'imported',
  is_public boolean not null default false,
  observed_at timestamptz not null,
  valid_from timestamptz,
  valid_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_entity_facts_key_format check (fact_key ~ '^[a-z0-9][a-z0-9_.-]*$'),
  constraint travel_entity_facts_locale_check check (locale is null or locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]+)*$'),
  constraint travel_entity_facts_confidence_check check (confidence between 0 and 1),
  constraint travel_entity_facts_review_check check (review_status in ('imported', 'editorial_reviewed', 'verified', 'deprecated')),
  constraint travel_entity_facts_validity_check check (valid_from is null or valid_until is null or valid_from <= valid_until),
  constraint travel_entity_facts_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.travel_tags (
  tag_key text primary key,
  tag_group text not null,
  label text not null,
  description text not null,
  evidence_required boolean not null default false,
  sensitive boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_tags_key_format check (tag_key ~ '^[a-z0-9][a-z0-9_]*$'),
  constraint travel_tags_group_check check (tag_group in ('trip_shape', 'experience', 'place_character', 'practical', 'audience_context')),
  constraint travel_tags_status_check check (status in ('active', 'inactive'))
);

create table if not exists public.travel_entity_tags (
  entity_id uuid not null references public.travel_entities(id) on delete cascade,
  tag_key text not null references public.travel_tags(tag_key) on delete restrict,
  source_id uuid not null references public.travel_sources(id) on delete restrict,
  relevance numeric(4, 3) not null default 0.5,
  evidence_level text not null,
  evidence_note text,
  valid_until timestamptz,
  is_public boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (entity_id, tag_key, source_id),
  constraint travel_entity_tags_relevance_check check (relevance between 0 and 1),
  constraint travel_entity_tags_evidence_check check (evidence_level in ('official', 'editorial', 'community', 'self_attested', 'inferred')),
  constraint travel_entity_tags_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.travel_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  country_code text not null,
  journey_type text not null,
  min_days integer not null,
  max_days integer not null,
  preferred_pace text not null default 'balanced',
  ideal_months smallint[] not null default '{}',
  dataset_version text not null,
  version integer not null default 1,
  status text not null default 'draft',
  attributes jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_templates_key_format check (template_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint travel_templates_country_code check (country_code ~ '^[A-Z]{2}$'),
  constraint travel_templates_journey_type_check check (journey_type in ('city_break', 'hub_and_day_trips', 'single_country_circuit', 'multi_country', 'road_trip', 'camper', 'cruise_shore', 'inspiration')),
  constraint travel_templates_duration_check check (min_days > 0 and max_days >= min_days),
  constraint travel_templates_pace_check check (preferred_pace in ('relaxed', 'balanced', 'full')),
  constraint travel_templates_months_check check (ideal_months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]),
  constraint travel_templates_version_check check (version > 0),
  constraint travel_templates_status_check check (status in ('draft', 'published', 'archived')),
  constraint travel_templates_attributes_object check (jsonb_typeof(attributes) = 'object')
);

create table if not exists public.travel_template_copy (
  template_id uuid not null references public.travel_templates(id) on delete cascade,
  locale text not null,
  title text not null,
  summary text not null,
  highlights jsonb not null default '[]'::jsonb,
  tradeoffs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (template_id, locale),
  constraint travel_template_copy_locale_check check (locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]+)*$'),
  constraint travel_template_copy_highlights_array check (jsonb_typeof(highlights) = 'array'),
  constraint travel_template_copy_tradeoffs_array check (jsonb_typeof(tradeoffs) = 'array')
);

create table if not exists public.travel_template_stops (
  template_id uuid not null references public.travel_templates(id) on delete cascade,
  sequence integer not null,
  entity_id uuid not null references public.travel_entities(id) on delete restrict,
  stop_role text not null,
  min_nights integer not null default 0,
  max_nights integer not null default 0,
  is_optional boolean not null default false,
  notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (template_id, sequence),
  constraint travel_template_stops_sequence_check check (sequence >= 0),
  constraint travel_template_stops_role_check check (stop_role in ('entry', 'exit', 'base', 'must_visit', 'day_trip', 'consider')),
  constraint travel_template_stops_nights_check check (min_nights >= 0 and max_nights >= min_nights),
  constraint travel_template_stops_notes_object check (jsonb_typeof(notes) = 'object')
);

create table if not exists public.travel_template_legs (
  template_id uuid not null references public.travel_templates(id) on delete cascade,
  sequence integer not null,
  from_entity_id uuid not null references public.travel_entities(id) on delete restrict,
  to_entity_id uuid not null references public.travel_entities(id) on delete restrict,
  leg_role text not null,
  transport_modes text[] not null default '{}',
  duration_min_minutes integer not null,
  duration_max_minutes integer not null,
  distance_km numeric(9, 2),
  round_trip boolean not null default false,
  source_id uuid not null references public.travel_sources(id) on delete restrict,
  confidence numeric(4, 3) not null default 0.72,
  observed_at timestamptz not null,
  valid_until timestamptz,
  notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (template_id, sequence),
  constraint travel_template_legs_sequence_check check (sequence >= 0),
  constraint travel_template_legs_entities_check check (from_entity_id <> to_entity_id),
  constraint travel_template_legs_role_check check (leg_role in ('transfer', 'day_trip')),
  constraint travel_template_legs_modes_check check (
    cardinality(transport_modes) > 0
    and transport_modes <@ array['plane', 'train', 'bus', 'boat', 'car', 'walk', 'bicycle', 'motorcycle']::text[]
  ),
  constraint travel_template_legs_duration_check check (
    duration_min_minutes > 0
    and duration_max_minutes >= duration_min_minutes
  ),
  constraint travel_template_legs_distance_check check (distance_km is null or distance_km > 0),
  constraint travel_template_legs_confidence_check check (confidence between 0 and 1),
  constraint travel_template_legs_validity_check check (valid_until is null or valid_until > observed_at),
  constraint travel_template_legs_notes_object check (jsonb_typeof(notes) = 'object')
);

create table if not exists public.travel_template_tags (
  template_id uuid not null references public.travel_templates(id) on delete cascade,
  tag_key text not null references public.travel_tags(tag_key) on delete restrict,
  weight numeric(4, 3) not null default 0.5,
  created_at timestamptz not null default now(),
  primary key (template_id, tag_key),
  constraint travel_template_tags_weight_check check (weight between 0 and 1)
);

-- Operational history is intentionally separate from the published projection.
-- These rows are admin/service-role only and are never returned by the public pack RPC.
create table if not exists public.travel_source_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.travel_sources(id) on delete restrict,
  country_code text not null,
  run_kind text not null,
  status text not null default 'queued',
  started_at timestamptz,
  finished_at timestamptz,
  fetcher_version text not null,
  configuration_hash text not null,
  terms_fingerprint text,
  robots_fingerprint text,
  http_summary jsonb not null default '{}'::jsonb,
  raw_item_count integer not null default 0,
  candidate_count integer not null default 0,
  warning_count integer not null default 0,
  error_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_source_runs_country_code_check check (country_code ~ '^[A-Z]{2}$'),
  constraint travel_source_runs_kind_check check (run_kind in ('fetch', 'editorial_refresh', 'license_audit', 'freshness_audit')),
  constraint travel_source_runs_status_check check (status in ('queued', 'running', 'succeeded', 'partial', 'failed', 'canceled')),
  constraint travel_source_runs_hash_check check (configuration_hash ~ '^[a-f0-9]{64}$'),
  constraint travel_source_runs_terms_fingerprint_check check (terms_fingerprint is null or terms_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint travel_source_runs_robots_fingerprint_check check (robots_fingerprint is null or robots_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint travel_source_runs_counts_check check (raw_item_count >= 0 and candidate_count >= 0 and warning_count >= 0 and error_count >= 0),
  constraint travel_source_runs_timeline_check check (
    (status = 'queued' and started_at is null and finished_at is null)
    or (status = 'running' and started_at is not null and finished_at is null)
    or (status in ('succeeded', 'partial', 'failed', 'canceled') and started_at is not null and finished_at is not null and finished_at >= started_at)
  ),
  constraint travel_source_runs_http_summary_object check (jsonb_typeof(http_summary) = 'object'),
  constraint travel_source_runs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.travel_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_run_id uuid not null references public.travel_source_runs(id) on delete restrict,
  source_url text not null,
  dataset_id text,
  retrieved_at timestamptz not null,
  etag text,
  last_modified text,
  checksum text not null,
  content_type text not null,
  byte_size bigint not null,
  storage_object_key text not null,
  license_key text,
  terms_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint travel_source_snapshots_url_check check (source_url ~ '^https://'),
  constraint travel_source_snapshots_checksum_check check (checksum ~ '^[a-f0-9]{64}$'),
  constraint travel_source_snapshots_byte_size_check check (byte_size >= 0),
  constraint travel_source_snapshots_storage_key_check check (length(trim(storage_object_key)) > 0),
  constraint travel_source_snapshots_terms_url_check check (terms_url is null or terms_url ~ '^https://'),
  constraint travel_source_snapshots_metadata_object check (jsonb_typeof(metadata) = 'object'),
  unique (source_run_id, checksum, storage_object_key)
);

-- Raw source payloads are immutable, private, and written only through the
-- Storage API by the server-side service role. The restrictive policies keep
-- this bucket private even if a broader permissive Storage policy is added later.
do $$
begin
  if exists (
    select 1
    from storage.buckets
    where (id = 'travel-knowledge-snapshots' or name = 'travel-knowledge-snapshots')
      and not (
        id = 'travel-knowledge-snapshots'
        and name = 'travel-knowledge-snapshots'
        and public is false
        and file_size_limit = 52428800
      )
  ) then
    raise exception 'Conflicting travel-knowledge-snapshots bucket configuration';
  end if;
end
$$;

insert into storage.buckets (id, name, public, file_size_limit)
values ('travel-knowledge-snapshots', 'travel-knowledge-snapshots', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "Travel knowledge bucket deny non-service access" on storage.buckets;
create policy "Travel knowledge bucket deny non-service access"
on storage.buckets
as restrictive for all to public
using (id <> 'travel-knowledge-snapshots')
with check (id <> 'travel-knowledge-snapshots');

drop policy if exists "Travel knowledge objects deny non-service access" on storage.objects;
create policy "Travel knowledge objects deny non-service access"
on storage.objects
as restrictive for all to public
using (bucket_id <> 'travel-knowledge-snapshots')
with check (bucket_id <> 'travel-knowledge-snapshots');

create table if not exists public.travel_change_candidates (
  id uuid primary key default gen_random_uuid(),
  source_snapshot_id uuid not null references public.travel_source_snapshots(id) on delete restrict,
  country_code text not null,
  target_kind text not null,
  target_key text not null,
  target_entity_id uuid references public.travel_entities(id) on delete restrict,
  target_template_id uuid references public.travel_templates(id) on delete restrict,
  field_path text not null,
  change_kind text not null,
  previous_value jsonb,
  proposed_value jsonb,
  extraction_method text not null,
  confidence numeric(4, 3) not null default 0.5,
  severity text not null default 'moderate',
  validation_findings jsonb not null default '[]'::jsonb,
  status text not null default 'new',
  superseded_by_candidate_id uuid references public.travel_change_candidates(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_change_candidates_country_code_check check (country_code ~ '^[A-Z]{2}$'),
  constraint travel_change_candidates_target_kind_check check (target_kind in ('source', 'entity', 'entity_name', 'fact', 'entity_tag', 'template', 'template_copy', 'template_stop', 'template_leg', 'dataset')),
  constraint travel_change_candidates_target_key_check check (length(trim(target_key)) > 0),
  constraint travel_change_candidates_field_path_check check (field_path ~ '^[A-Za-z0-9_.\[\]-]+$'),
  constraint travel_change_candidates_change_kind_check check (change_kind in ('add', 'update', 'remove')),
  constraint travel_change_candidates_value_check check (previous_value is not null or proposed_value is not null),
  constraint travel_change_candidates_extraction_check check (extraction_method in ('structured_import', 'deterministic_transform', 'llm_assisted', 'manual_editorial', 'traveler_correction')),
  constraint travel_change_candidates_confidence_check check (confidence between 0 and 1),
  constraint travel_change_candidates_severity_check check (severity in ('low', 'moderate', 'high', 'critical')),
  constraint travel_change_candidates_findings_array check (jsonb_typeof(validation_findings) = 'array'),
  constraint travel_change_candidates_status_check check (status in ('new', 'needs_review', 'accepted', 'rejected', 'superseded')),
  constraint travel_change_candidates_no_self_supersede check (superseded_by_candidate_id is null or superseded_by_candidate_id <> id),
  constraint travel_change_candidates_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.travel_review_decisions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.travel_change_candidates(id) on delete restrict,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decision text not null,
  reason text not null,
  accepted_value jsonb,
  review_policy_version text not null,
  reviewed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint travel_review_decisions_decision_check check (decision in ('accept', 'accept_with_edit', 'reject', 'request_changes')),
  constraint travel_review_decisions_reason_check check (length(trim(reason)) > 0),
  constraint travel_review_decisions_edit_value_check check (decision <> 'accept_with_edit' or accepted_value is not null),
  constraint travel_review_decisions_policy_check check (length(trim(review_policy_version)) > 0),
  constraint travel_review_decisions_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.travel_dataset_artifacts (
  id uuid primary key default gen_random_uuid(),
  dataset_version_id uuid not null references public.travel_dataset_versions(id) on delete restrict,
  parent_dataset_version_id uuid references public.travel_dataset_versions(id) on delete restrict,
  repository_commit text not null,
  source_run_ids uuid[] not null default '{}',
  pack_checksum text not null,
  seed_checksum text not null,
  artifact_checksum text not null,
  storage_object_key text not null,
  validation_report jsonb not null default '{}'::jsonb,
  status text not null default 'staged',
  staged_at timestamptz not null default now(),
  published_at timestamptz,
  superseded_at timestamptz,
  rolled_back_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_dataset_artifacts_commit_check check (repository_commit ~ '^[a-f0-9]{7,64}$'),
  constraint travel_dataset_artifacts_pack_checksum_check check (pack_checksum ~ '^[a-f0-9]{64}$'),
  constraint travel_dataset_artifacts_seed_checksum_check check (seed_checksum ~ '^[a-f0-9]{64}$'),
  constraint travel_dataset_artifacts_checksum_check check (artifact_checksum ~ '^[a-f0-9]{64}$'),
  constraint travel_dataset_artifacts_storage_key_check check (length(trim(storage_object_key)) > 0),
  constraint travel_dataset_artifacts_report_object check (jsonb_typeof(validation_report) = 'object'),
  constraint travel_dataset_artifacts_status_check check (status in ('staged', 'published', 'superseded', 'rolled_back', 'failed')),
  constraint travel_dataset_artifacts_parent_check check (parent_dataset_version_id is null or parent_dataset_version_id <> dataset_version_id),
  constraint travel_dataset_artifacts_timeline_check check (
    (status = 'staged' and published_at is null and superseded_at is null and rolled_back_at is null)
    or (status = 'published' and published_at is not null and superseded_at is null and rolled_back_at is null)
    or (status = 'superseded' and published_at is not null and superseded_at is not null and rolled_back_at is null)
    or (status = 'rolled_back' and published_at is not null and rolled_back_at is not null)
    or status = 'failed'
  ),
  unique (dataset_version_id, artifact_checksum)
);

alter table public.travel_dataset_artifacts add column if not exists review_candidate_ids uuid[] not null default '{}';
alter table public.travel_dataset_artifacts add column if not exists review_decision_ids uuid[] not null default '{}';

create table if not exists public.travel_dataset_payloads (
  id uuid primary key default gen_random_uuid(),
  dataset_version_id uuid not null references public.travel_dataset_versions(id) on delete restrict,
  country_code text not null,
  locale text not null default 'en',
  pack_payload jsonb not null,
  template_copy_payload jsonb not null default '{}'::jsonb,
  pack_checksum text not null,
  pack_byte_size bigint not null,
  validation_report jsonb not null default '{}'::jsonb,
  status text not null default 'staged',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_dataset_payloads_country_code_check check (country_code ~ '^[A-Z]{2}$'),
  constraint travel_dataset_payloads_locale_check check (locale ~ '^[a-z]{2,3}(-[a-z0-9]+)*$'),
  constraint travel_dataset_payloads_pack_object check (jsonb_typeof(pack_payload) = 'object'),
  constraint travel_dataset_payloads_template_copy_object check (jsonb_typeof(template_copy_payload) = 'object'),
  constraint travel_dataset_payloads_pack_checksum_check check (pack_checksum ~ '^[a-f0-9]{64}$'),
  constraint travel_dataset_payloads_pack_size_check check (pack_byte_size > 0),
  constraint travel_dataset_payloads_report_object check (jsonb_typeof(validation_report) = 'object'),
  constraint travel_dataset_payloads_status_check check (status in ('staged', 'published', 'retired')),
  unique (dataset_version_id, locale)
);

create table if not exists public.travel_active_datasets (
  country_code text primary key,
  dataset_version_id uuid not null references public.travel_dataset_versions(id) on delete restrict,
  artifact_id uuid not null references public.travel_dataset_artifacts(id) on delete restrict,
  activated_by uuid references auth.users(id) on delete set null,
  activated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_active_datasets_country_code_check check (country_code ~ '^[A-Z]{2}$')
);

create table if not exists public.travel_dataset_activations (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  action text not null,
  from_dataset_version_id uuid references public.travel_dataset_versions(id) on delete restrict,
  from_artifact_id uuid references public.travel_dataset_artifacts(id) on delete restrict,
  to_dataset_version_id uuid not null references public.travel_dataset_versions(id) on delete restrict,
  to_artifact_id uuid not null references public.travel_dataset_artifacts(id) on delete restrict,
  reason text not null,
  activated_by uuid references auth.users(id) on delete set null,
  actor_kind text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint travel_dataset_activations_country_code_check check (country_code ~ '^[A-Z]{2}$'),
  constraint travel_dataset_activations_action_check check (action in ('publish', 'rollback')),
  constraint travel_dataset_activations_reason_check check (length(trim(reason)) > 0),
  constraint travel_dataset_activations_actor_check check (actor_kind in ('admin', 'service_role')),
  constraint travel_dataset_activations_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint travel_dataset_activations_transition_check check (
    from_artifact_id is null
    or from_artifact_id <> to_artifact_id
  )
);

create index if not exists travel_sources_status_idx on public.travel_sources(status);
create index if not exists travel_dataset_versions_country_status_idx on public.travel_dataset_versions(country_code, status, published_at desc);
create index if not exists travel_entities_parent_idx on public.travel_entities(parent_id);
create index if not exists travel_entities_country_type_status_idx on public.travel_entities(country_code, entity_type, status);
create index if not exists travel_entities_popularity_idx on public.travel_entities(country_code, popularity_score desc);
create index if not exists travel_entity_names_search_idx on public.travel_entity_names(lower(name));
create index if not exists travel_entity_facts_entity_key_idx on public.travel_entity_facts(entity_id, fact_key);
create index if not exists travel_entity_facts_source_idx on public.travel_entity_facts(source_id);
create index if not exists travel_entity_facts_public_validity_idx on public.travel_entity_facts(is_public, valid_until);
create index if not exists travel_entity_tags_tag_idx on public.travel_entity_tags(tag_key, relevance desc);
create index if not exists travel_entity_tags_source_idx on public.travel_entity_tags(source_id);
create index if not exists travel_templates_country_shape_status_idx on public.travel_templates(country_code, journey_type, status, min_days, max_days);
create index if not exists travel_template_stops_entity_idx on public.travel_template_stops(entity_id);
create index if not exists travel_template_legs_entities_idx on public.travel_template_legs(from_entity_id, to_entity_id);
create index if not exists travel_template_legs_to_entity_idx on public.travel_template_legs(to_entity_id);
create index if not exists travel_template_legs_source_idx on public.travel_template_legs(source_id);
create index if not exists travel_template_legs_validity_idx on public.travel_template_legs(valid_until);
create index if not exists travel_template_tags_tag_idx on public.travel_template_tags(tag_key);
create index if not exists travel_source_runs_source_started_idx on public.travel_source_runs(source_id, started_at desc);
create index if not exists travel_source_runs_country_status_idx on public.travel_source_runs(country_code, status, created_at desc);
create index if not exists travel_source_snapshots_run_idx on public.travel_source_snapshots(source_run_id, retrieved_at desc);
create index if not exists travel_source_snapshots_checksum_idx on public.travel_source_snapshots(checksum);
create index if not exists travel_change_candidates_snapshot_idx on public.travel_change_candidates(source_snapshot_id);
create index if not exists travel_change_candidates_status_idx on public.travel_change_candidates(country_code, status, severity, created_at);
create index if not exists travel_change_candidates_entity_idx on public.travel_change_candidates(target_entity_id) where target_entity_id is not null;
create index if not exists travel_change_candidates_template_idx on public.travel_change_candidates(target_template_id) where target_template_id is not null;
create index if not exists travel_change_candidates_superseded_by_idx on public.travel_change_candidates(superseded_by_candidate_id) where superseded_by_candidate_id is not null;
create index if not exists travel_review_decisions_candidate_idx on public.travel_review_decisions(candidate_id, reviewed_at desc);
create index if not exists travel_review_decisions_reviewer_idx on public.travel_review_decisions(reviewer_id, reviewed_at desc);
create index if not exists travel_dataset_artifacts_dataset_status_idx on public.travel_dataset_artifacts(dataset_version_id, status, created_at desc);
create index if not exists travel_dataset_artifacts_parent_idx on public.travel_dataset_artifacts(parent_dataset_version_id) where parent_dataset_version_id is not null;
create index if not exists travel_dataset_artifacts_created_by_idx on public.travel_dataset_artifacts(created_by) where created_by is not null;
create index if not exists travel_dataset_payloads_country_status_idx on public.travel_dataset_payloads(country_code, status, created_at desc);
create index if not exists travel_dataset_payloads_created_by_idx on public.travel_dataset_payloads(created_by) where created_by is not null;
create index if not exists travel_active_datasets_dataset_version_idx on public.travel_active_datasets(dataset_version_id);
create index if not exists travel_active_datasets_artifact_idx on public.travel_active_datasets(artifact_id);
create index if not exists travel_active_datasets_activated_by_idx on public.travel_active_datasets(activated_by) where activated_by is not null;
create index if not exists travel_dataset_activations_country_created_idx on public.travel_dataset_activations(country_code, created_at desc);
create index if not exists travel_dataset_activations_to_artifact_idx on public.travel_dataset_activations(to_artifact_id, created_at desc);
create index if not exists travel_dataset_activations_from_artifact_idx on public.travel_dataset_activations(from_artifact_id) where from_artifact_id is not null;
create index if not exists travel_dataset_activations_from_dataset_version_idx on public.travel_dataset_activations(from_dataset_version_id) where from_dataset_version_id is not null;
create index if not exists travel_dataset_activations_to_dataset_version_idx on public.travel_dataset_activations(to_dataset_version_id);
create index if not exists travel_dataset_activations_activated_by_idx on public.travel_dataset_activations(activated_by) where activated_by is not null;

drop trigger if exists set_travel_sources_updated_at on public.travel_sources;
create trigger set_travel_sources_updated_at before update on public.travel_sources
for each row execute function public.set_updated_at();

drop trigger if exists set_travel_dataset_versions_updated_at on public.travel_dataset_versions;
create trigger set_travel_dataset_versions_updated_at before update on public.travel_dataset_versions
for each row execute function public.set_updated_at();

drop trigger if exists set_travel_entities_updated_at on public.travel_entities;
create trigger set_travel_entities_updated_at before update on public.travel_entities
for each row execute function public.set_updated_at();

drop trigger if exists set_travel_entity_facts_updated_at on public.travel_entity_facts;
create trigger set_travel_entity_facts_updated_at before update on public.travel_entity_facts
for each row execute function public.set_updated_at();

drop trigger if exists set_travel_tags_updated_at on public.travel_tags;
create trigger set_travel_tags_updated_at before update on public.travel_tags
for each row execute function public.set_updated_at();

drop trigger if exists set_travel_entity_tags_updated_at on public.travel_entity_tags;
create trigger set_travel_entity_tags_updated_at before update on public.travel_entity_tags
for each row execute function public.set_updated_at();

drop trigger if exists set_travel_templates_updated_at on public.travel_templates;
create trigger set_travel_templates_updated_at before update on public.travel_templates
for each row execute function public.set_updated_at();

drop trigger if exists set_travel_template_copy_updated_at on public.travel_template_copy;
create trigger set_travel_template_copy_updated_at before update on public.travel_template_copy
for each row execute function public.set_updated_at();

drop trigger if exists set_travel_template_stops_updated_at on public.travel_template_stops;
create trigger set_travel_template_stops_updated_at before update on public.travel_template_stops
for each row execute function public.set_updated_at();

drop trigger if exists set_travel_template_legs_updated_at on public.travel_template_legs;
create trigger set_travel_template_legs_updated_at before update on public.travel_template_legs
for each row execute function public.set_updated_at();

drop trigger if exists set_travel_source_runs_updated_at on public.travel_source_runs;
create trigger set_travel_source_runs_updated_at before update on public.travel_source_runs
for each row execute function public.set_updated_at();

drop trigger if exists set_travel_change_candidates_updated_at on public.travel_change_candidates;
create trigger set_travel_change_candidates_updated_at before update on public.travel_change_candidates
for each row execute function public.set_updated_at();

drop trigger if exists set_travel_dataset_artifacts_updated_at on public.travel_dataset_artifacts;
create trigger set_travel_dataset_artifacts_updated_at before update on public.travel_dataset_artifacts
for each row execute function public.set_updated_at();

drop trigger if exists set_travel_dataset_payloads_updated_at on public.travel_dataset_payloads;
create trigger set_travel_dataset_payloads_updated_at before update on public.travel_dataset_payloads
for each row execute function public.set_updated_at();

drop trigger if exists set_travel_active_datasets_updated_at on public.travel_active_datasets;
create trigger set_travel_active_datasets_updated_at before update on public.travel_active_datasets
for each row execute function public.set_updated_at();

alter table public.travel_sources enable row level security;
alter table public.travel_dataset_versions enable row level security;
alter table public.travel_entities enable row level security;
alter table public.travel_entity_names enable row level security;
alter table public.travel_entity_facts enable row level security;
alter table public.travel_tags enable row level security;
alter table public.travel_entity_tags enable row level security;
alter table public.travel_templates enable row level security;
alter table public.travel_template_copy enable row level security;
alter table public.travel_template_stops enable row level security;
alter table public.travel_template_legs enable row level security;
alter table public.travel_template_tags enable row level security;
alter table public.travel_source_runs enable row level security;
alter table public.travel_source_snapshots enable row level security;
alter table public.travel_change_candidates enable row level security;
alter table public.travel_review_decisions enable row level security;
alter table public.travel_dataset_artifacts enable row level security;
alter table public.travel_dataset_payloads enable row level security;
alter table public.travel_active_datasets enable row level security;
alter table public.travel_dataset_activations enable row level security;

drop policy if exists "Travel sources public read" on public.travel_sources;
create policy "Travel sources public read"
on public.travel_sources for select
using (status = 'active');

drop policy if exists "Travel dataset versions public read" on public.travel_dataset_versions;
create policy "Travel dataset versions public read"
on public.travel_dataset_versions for select
using (status = 'published');

drop policy if exists "Travel entities public read" on public.travel_entities;
create policy "Travel entities public read"
on public.travel_entities for select
using (status = 'published');

drop policy if exists "Travel entity names public read" on public.travel_entity_names;
create policy "Travel entity names public read"
on public.travel_entity_names for select
using (
  exists (
    select 1 from public.travel_entities entity
    where entity.id = travel_entity_names.entity_id
      and entity.status = 'published'
  )
);

drop policy if exists "Travel entity facts public read" on public.travel_entity_facts;
create policy "Travel entity facts public read"
on public.travel_entity_facts for select
using (
  is_public = true
  and review_status in ('editorial_reviewed', 'verified')
  and (valid_until is null or valid_until > now())
  and exists (
    select 1 from public.travel_entities entity
    where entity.id = travel_entity_facts.entity_id
      and entity.status = 'published'
  )
);

drop policy if exists "Travel tags public read" on public.travel_tags;
create policy "Travel tags public read"
on public.travel_tags for select
using (status = 'active');

drop policy if exists "Travel entity tags public read" on public.travel_entity_tags;
create policy "Travel entity tags public read"
on public.travel_entity_tags for select
using (
  is_public = true
  and evidence_level in ('official', 'editorial', 'community', 'self_attested')
  and (valid_until is null or valid_until > now())
  and exists (
    select 1 from public.travel_entities entity
    where entity.id = travel_entity_tags.entity_id
      and entity.status = 'published'
  )
);

drop policy if exists "Travel templates public read" on public.travel_templates;
create policy "Travel templates public read"
on public.travel_templates for select
using (status = 'published');

drop policy if exists "Travel template copy public read" on public.travel_template_copy;
create policy "Travel template copy public read"
on public.travel_template_copy for select
using (
  exists (
    select 1 from public.travel_templates template
    where template.id = travel_template_copy.template_id
      and template.status = 'published'
  )
);

drop policy if exists "Travel template stops public read" on public.travel_template_stops;
create policy "Travel template stops public read"
on public.travel_template_stops for select
using (
  exists (
    select 1 from public.travel_templates template
    where template.id = travel_template_stops.template_id
      and template.status = 'published'
  )
);

drop policy if exists "Travel template legs public read" on public.travel_template_legs;
create policy "Travel template legs public read"
on public.travel_template_legs for select
using (
  (valid_until is null or valid_until > now())
  and exists (
    select 1 from public.travel_templates template
    where template.id = travel_template_legs.template_id
      and template.status = 'published'
  )
);

drop policy if exists "Travel template tags public read" on public.travel_template_tags;
create policy "Travel template tags public read"
on public.travel_template_tags for select
using (
  exists (
    select 1 from public.travel_templates template
    where template.id = travel_template_tags.template_id
      and template.status = 'published'
  )
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'travel_sources',
    'travel_dataset_versions',
    'travel_entities',
    'travel_entity_names',
    'travel_entity_facts',
    'travel_tags',
    'travel_entity_tags',
    'travel_templates',
    'travel_template_copy',
    'travel_template_stops',
    'travel_template_legs',
    'travel_template_tags'
  ]
  loop
    execute format('drop policy if exists "Travel knowledge admin manage" on public.%I', table_name);
    execute format(
      'create policy "Travel knowledge admin manage" on public.%I for all to authenticated using (not coalesce(((select auth.jwt()) ->> ''is_anonymous'')::boolean, false) and public.is_admin((select auth.uid()))) with check (not coalesce(((select auth.jwt()) ->> ''is_anonymous'')::boolean, false) and public.is_admin((select auth.uid())))',
      table_name
    );
  end loop;
end
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'travel_source_runs',
    'travel_change_candidates',
    'travel_dataset_artifacts',
    'travel_dataset_payloads',
    'travel_active_datasets'
  ]
  loop
    execute format('drop policy if exists "Travel operations admin manage" on public.%I', table_name);
    execute format(
      'create policy "Travel operations admin manage" on public.%I for all to authenticated using (not coalesce(((select auth.jwt()) ->> ''is_anonymous'')::boolean, false) and public.is_admin((select auth.uid()))) with check (not coalesce(((select auth.jwt()) ->> ''is_anonymous'')::boolean, false) and public.is_admin((select auth.uid())))',
      table_name
    );
  end loop;
end
$$;

drop policy if exists "Travel active datasets public read" on public.travel_active_datasets;
create policy "Travel active datasets public read"
on public.travel_active_datasets for select
using (true);

drop policy if exists "Travel active payload public read" on public.travel_dataset_payloads;
create policy "Travel active payload public read"
on public.travel_dataset_payloads for select
using (
  status = 'published'
  and exists (
    select 1
    from public.travel_active_datasets active_dataset
    where active_dataset.dataset_version_id = travel_dataset_payloads.dataset_version_id
      and active_dataset.country_code = travel_dataset_payloads.country_code
  )
);

drop policy if exists "Travel dataset activations admin read" on public.travel_dataset_activations;
create policy "Travel dataset activations admin read"
on public.travel_dataset_activations for select to authenticated
using (
  not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
  and public.is_admin((select auth.uid()))
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'travel_source_snapshots'
  ]
  loop
    execute format('drop policy if exists "Travel operations admin read" on public.%I', table_name);
    execute format('drop policy if exists "Travel operations admin insert" on public.%I', table_name);
    execute format(
      'create policy "Travel operations admin read" on public.%I for select to authenticated using (not coalesce(((select auth.jwt()) ->> ''is_anonymous'')::boolean, false) and public.is_admin((select auth.uid())))',
      table_name
    );
    execute format(
      'create policy "Travel operations admin insert" on public.%I for insert to authenticated with check (not coalesce(((select auth.jwt()) ->> ''is_anonymous'')::boolean, false) and public.is_admin((select auth.uid())))',
      table_name
    );
  end loop;
end
$$;

drop policy if exists "Travel operations admin insert" on public.travel_review_decisions;
drop policy if exists "Travel operations admin read" on public.travel_review_decisions;
create policy "Travel operations admin read"
on public.travel_review_decisions for select to authenticated
using (
  not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
  and public.is_admin((select auth.uid()))
);

revoke all on table
  public.travel_source_runs,
  public.travel_source_snapshots,
  public.travel_change_candidates,
  public.travel_review_decisions,
  public.travel_dataset_artifacts,
  public.travel_dataset_payloads,
  public.travel_active_datasets,
  public.travel_dataset_activations
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.travel_source_runs,
  public.travel_change_candidates
to authenticated;

grant select on table
  public.travel_dataset_artifacts,
  public.travel_dataset_activations
to authenticated;

grant select (country_code, dataset_version_id) on table public.travel_active_datasets to anon, authenticated;
grant select (dataset_version_id, country_code, locale, pack_payload, template_copy_payload, status) on table public.travel_dataset_payloads to anon, authenticated;

grant select, insert on table
  public.travel_source_snapshots
to authenticated;

grant select on table
  public.travel_review_decisions
to authenticated;

grant all on table
  public.travel_source_runs,
  public.travel_source_snapshots,
  public.travel_change_candidates,
  public.travel_review_decisions,
  public.travel_dataset_artifacts,
  public.travel_dataset_payloads,
  public.travel_active_datasets,
  public.travel_dataset_activations
to service_role;

revoke all on table
  public.travel_sources,
  public.travel_dataset_versions,
  public.travel_entities,
  public.travel_entity_names,
  public.travel_entity_facts,
  public.travel_tags,
  public.travel_entity_tags,
  public.travel_templates,
  public.travel_template_copy,
  public.travel_template_stops,
  public.travel_template_legs,
  public.travel_template_tags
from public, anon, authenticated;

grant all on table
  public.travel_sources,
  public.travel_dataset_versions,
  public.travel_entities,
  public.travel_entity_names,
  public.travel_entity_facts,
  public.travel_tags,
  public.travel_entity_tags,
  public.travel_templates,
  public.travel_template_copy,
  public.travel_template_stops,
  public.travel_template_legs,
  public.travel_template_tags
to service_role;

drop function if exists public.admin_list_travel_knowledge_candidates(text, text[], integer, integer);
create or replace function public.admin_list_travel_knowledge_candidates(
  p_country_code text default null,
  p_statuses text[] default array[]::text[],
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  candidate_id uuid,
  source_snapshot_id uuid,
  source_run_id uuid,
  country_code text,
  target_kind text,
  target_key text,
  target_name text,
  target_entity_id uuid,
  target_template_id uuid,
  field_path text,
  change_kind text,
  previous_value jsonb,
  proposed_value jsonb,
  extraction_method text,
  confidence numeric,
  severity text,
  validation_findings jsonb,
  status text,
  source_key text,
  source_name text,
  source_url text,
  retrieved_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  review_count bigint,
  latest_decision text,
  latest_reason text,
  latest_accepted_value jsonb,
  latest_reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null
    or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    or not public.is_admin(v_uid) then
    raise exception 'Admin access required.';
  end if;

  return query
  select
    candidate.id,
    candidate.source_snapshot_id,
    source_run.id,
    candidate.country_code,
    candidate.target_kind,
    candidate.target_key,
    coalesce(entity.primary_name, template.template_key, candidate.target_key),
    candidate.target_entity_id,
    candidate.target_template_id,
    candidate.field_path,
    candidate.change_kind,
    candidate.previous_value,
    candidate.proposed_value,
    candidate.extraction_method,
    candidate.confidence,
    candidate.severity,
    candidate.validation_findings,
    candidate.status,
    source.source_key,
    source.name,
    snapshot.source_url,
    snapshot.retrieved_at,
    candidate.created_at,
    candidate.updated_at,
    coalesce(review_summary.review_count, 0),
    latest_review.decision,
    latest_review.reason,
    latest_review.accepted_value,
    latest_review.reviewed_at
  from public.travel_change_candidates candidate
  join public.travel_source_snapshots snapshot on snapshot.id = candidate.source_snapshot_id
  join public.travel_source_runs source_run on source_run.id = snapshot.source_run_id
  join public.travel_sources source on source.id = source_run.source_id
  left join public.travel_entities entity on entity.id = candidate.target_entity_id
  left join public.travel_templates template on template.id = candidate.target_template_id
  left join lateral (
    select count(*)::bigint as review_count
    from public.travel_review_decisions decision_count
    where decision_count.candidate_id = candidate.id
  ) review_summary on true
  left join lateral (
    select decision.decision, decision.reason, decision.accepted_value, decision.reviewed_at
    from public.travel_review_decisions decision
    where decision.candidate_id = candidate.id
    order by decision.reviewed_at desc, decision.created_at desc
    limit 1
  ) latest_review on true
  where (
      p_country_code is null
      or trim(p_country_code) = ''
      or candidate.country_code = upper(trim(p_country_code))
    )
    and (
      coalesce(cardinality(p_statuses), 0) = 0
      or candidate.status = any(p_statuses)
    )
  order by
    case candidate.severity
      when 'critical' then 0
      when 'high' then 1
      when 'moderate' then 2
      else 3
    end,
    candidate.created_at asc,
    candidate.id asc
  limit least(greatest(coalesce(p_limit, 100), 1), 250)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

drop function if exists public.admin_get_travel_knowledge_review_summary(text);
create or replace function public.admin_get_travel_knowledge_review_summary(
  p_country_code text default null
)
returns table(
  candidate_total bigint,
  new_count bigint,
  needs_review_count bigint,
  accepted_count bigint,
  rejected_count bigint,
  successful_run_count bigint,
  snapshot_count bigint,
  latest_source_run_at timestamptz
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null
    or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    or not public.is_admin(v_uid) then
    raise exception 'Admin access required.';
  end if;

  return query
  with candidate_summary as (
    select
      count(*)::bigint as candidate_total,
      count(*) filter (where candidate.status = 'new')::bigint as new_count,
      count(*) filter (where candidate.status = 'needs_review')::bigint as needs_review_count,
      count(*) filter (where candidate.status = 'accepted')::bigint as accepted_count,
      count(*) filter (where candidate.status = 'rejected')::bigint as rejected_count
    from public.travel_change_candidates candidate
    where p_country_code is null
      or trim(p_country_code) = ''
      or candidate.country_code = upper(trim(p_country_code))
  ),
  run_summary as (
    select
      count(*) filter (where source_run.status = 'succeeded')::bigint as successful_run_count,
      max(coalesce(source_run.finished_at, source_run.started_at, source_run.created_at)) as latest_source_run_at
    from public.travel_source_runs source_run
    where p_country_code is null
      or trim(p_country_code) = ''
      or source_run.country_code = upper(trim(p_country_code))
  ),
  snapshot_summary as (
    select count(*)::bigint as snapshot_count
    from public.travel_source_snapshots snapshot
    join public.travel_source_runs source_run on source_run.id = snapshot.source_run_id
    where p_country_code is null
      or trim(p_country_code) = ''
      or source_run.country_code = upper(trim(p_country_code))
  )
  select
    candidate_summary.candidate_total,
    candidate_summary.new_count,
    candidate_summary.needs_review_count,
    candidate_summary.accepted_count,
    candidate_summary.rejected_count,
    run_summary.successful_run_count,
    snapshot_summary.snapshot_count,
    run_summary.latest_source_run_at
  from candidate_summary
  cross join run_summary
  cross join snapshot_summary;
end;
$$;

drop function if exists public.admin_review_travel_knowledge_candidate(uuid, text, text, jsonb, text);
create or replace function public.admin_review_travel_knowledge_candidate(
  p_candidate_id uuid,
  p_decision text,
  p_reason text,
  p_accepted_value jsonb default null,
  p_review_policy_version text default 'travel-review-v1'
)
returns table(
  candidate_id uuid,
  candidate_status text,
  decision_id uuid,
  decision text,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
  v_candidate public.travel_change_candidates%rowtype;
  v_candidate_status text;
  v_decision_id uuid;
  v_reviewed_at timestamptz;
begin
  if v_uid is null
    or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    or not public.is_admin(v_uid) then
    raise exception 'Admin access required.';
  end if;

  if p_decision is null or p_decision not in ('accept', 'accept_with_edit', 'reject', 'request_changes') then
    raise exception 'Unsupported travel knowledge decision.';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'A review reason is required.';
  end if;

  if nullif(trim(coalesce(p_review_policy_version, '')), '') is null then
    raise exception 'A review policy version is required.';
  end if;

  if p_decision = 'accept_with_edit' and p_accepted_value is null then
    raise exception 'An edited value is required for accept_with_edit.';
  end if;

  select candidate.*
    into v_candidate
    from public.travel_change_candidates candidate
   where candidate.id = p_candidate_id
   for update;

  if not found then
    raise exception 'Travel knowledge candidate not found.';
  end if;

  if v_candidate.status not in ('new', 'needs_review') then
    raise exception 'Travel knowledge candidate has already reached a terminal state.';
  end if;

  v_candidate_status := case
    when p_decision in ('accept', 'accept_with_edit') then 'accepted'
    when p_decision = 'reject' then 'rejected'
    else 'needs_review'
  end;

  insert into public.travel_review_decisions (
    candidate_id,
    reviewer_id,
    decision,
    reason,
    accepted_value,
    review_policy_version,
    metadata
  )
  values (
    v_candidate.id,
    v_uid,
    p_decision,
    trim(p_reason),
    case
      when p_decision = 'accept' then v_candidate.proposed_value
      when p_decision = 'accept_with_edit' then p_accepted_value
      else null
    end,
    trim(p_review_policy_version),
    jsonb_build_object(
      'candidateStatusBefore', v_candidate.status,
      'candidateStatusAfter', v_candidate_status
    )
  )
  returning id, reviewed_at into v_decision_id, v_reviewed_at;

  update public.travel_change_candidates candidate
     set status = v_candidate_status,
         updated_at = now()
   where candidate.id = v_candidate.id;

  return query
  select v_candidate.id, v_candidate_status, v_decision_id, p_decision, v_reviewed_at;
end;
$$;

revoke all on function public.admin_list_travel_knowledge_candidates(text, text[], integer, integer) from public, anon;
revoke all on function public.admin_get_travel_knowledge_review_summary(text) from public, anon;
revoke all on function public.admin_review_travel_knowledge_candidate(uuid, text, text, jsonb, text) from public, anon;

grant execute on function public.admin_list_travel_knowledge_candidates(text, text[], integer, integer) to authenticated;
grant execute on function public.admin_get_travel_knowledge_review_summary(text) to authenticated;
grant execute on function public.admin_review_travel_knowledge_candidate(uuid, text, text, jsonb, text) to authenticated;

drop function if exists public.admin_stage_travel_dataset_artifact(
  text, text, text, text, integer, integer, integer, jsonb, timestamptz, text,
  text, uuid[], uuid[], uuid[], jsonb, jsonb, text, text, text, text, bigint, jsonb
);
create or replace function public.admin_stage_travel_dataset_artifact(
  p_dataset_key text,
  p_country_code text,
  p_version text,
  p_dataset_checksum text,
  p_entity_count integer,
  p_fact_count integer,
  p_template_count integer,
  p_source_snapshot jsonb,
  p_generated_at timestamptz,
  p_notes text,
  p_repository_commit text,
  p_source_run_ids uuid[],
  p_review_candidate_ids uuid[],
  p_review_decision_ids uuid[],
  p_pack_payload jsonb,
  p_template_copy_payload jsonb,
  p_pack_checksum text,
  p_seed_checksum text,
  p_artifact_checksum text,
  p_storage_object_key text,
  p_pack_byte_size bigint,
  p_validation_report jsonb
)
returns table(
  dataset_version_id uuid,
  payload_id uuid,
  artifact_id uuid,
  artifact_status text,
  already_staged boolean
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
  v_service_role boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  v_country_code text := upper(trim(coalesce(p_country_code, '')));
  v_dataset_key text := trim(coalesce(p_dataset_key, ''));
  v_version text := trim(coalesce(p_version, ''));
  v_dataset_version public.travel_dataset_versions%rowtype;
  v_payload public.travel_dataset_payloads%rowtype;
  v_artifact public.travel_dataset_artifacts%rowtype;
  v_parent_dataset_version_id uuid;
  v_pack_entity_count integer;
  v_pack_fact_count integer;
  v_pack_template_count integer;
begin
  if not v_service_role and (
    v_uid is null
    or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    or not public.is_admin(v_uid)
  ) then
    raise exception 'Admin or service-role access required.';
  end if;

  if v_dataset_key !~ '^[a-z0-9][a-z0-9_-]*$'
    or v_country_code !~ '^[A-Z]{2}$'
    or v_version = '' then
    raise exception 'Dataset key, country code, or version is invalid.';
  end if;
  if p_dataset_checksum !~ '^[a-f0-9]{64}$'
    or p_pack_checksum !~ '^[a-f0-9]{64}$'
    or p_seed_checksum !~ '^[a-f0-9]{64}$'
    or p_artifact_checksum !~ '^[a-f0-9]{64}$' then
    raise exception 'Dataset artifact checksums must be lowercase SHA-256 values.';
  end if;
  if p_repository_commit !~ '^[a-f0-9]{7,64}$' then
    raise exception 'Repository commit is invalid.';
  end if;
  if nullif(trim(coalesce(p_storage_object_key, '')), '') is null or coalesce(p_pack_byte_size, 0) <= 0 then
    raise exception 'A storage object key and positive pack byte size are required.';
  end if;
  if jsonb_typeof(p_source_snapshot) <> 'array'
    or jsonb_typeof(p_pack_payload) <> 'object'
    or jsonb_typeof(p_template_copy_payload) <> 'object'
    or jsonb_typeof(p_validation_report) <> 'object'
    or not coalesce((p_validation_report ->> 'passed')::boolean, false) then
    raise exception 'Only a validated object payload can be staged.';
  end if;
  if p_pack_payload ->> 'countryCode' <> v_country_code
    or p_pack_payload #>> '{dataset,datasetKey}' <> v_dataset_key
    or p_pack_payload #>> '{dataset,version}' <> v_version
    or p_pack_payload #>> '{dataset,checksum}' <> p_dataset_checksum
    or (p_pack_payload #>> '{dataset,generatedAt}')::timestamptz <> p_generated_at then
    raise exception 'Pack identity does not match the staged dataset manifest.';
  end if;
  if p_generated_at > now() then
    raise exception 'Dataset generatedAt cannot be later than staging time.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_pack_payload -> 'entities', '[]'::jsonb)) entity
    cross join lateral jsonb_array_elements(coalesce(entity -> 'facts', '[]'::jsonb)) fact
    where nullif(fact ->> 'observedAt', '')::timestamptz > p_generated_at
  ) then
    raise exception 'Dataset facts cannot be observed after generatedAt.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_pack_payload -> 'templates', '[]'::jsonb)) template
    cross join lateral jsonb_array_elements(coalesce(template -> 'legs', '[]'::jsonb)) leg
    where nullif(leg ->> 'observedAt', '')::timestamptz > p_generated_at
  ) then
    raise exception 'Dataset route legs cannot be observed after generatedAt.';
  end if;

  v_pack_entity_count := jsonb_array_length(coalesce(p_pack_payload -> 'entities', '[]'::jsonb));
  v_pack_template_count := jsonb_array_length(coalesce(p_pack_payload -> 'templates', '[]'::jsonb));
  select coalesce(sum(jsonb_array_length(coalesce(entity -> 'facts', '[]'::jsonb))), 0)::integer
    into v_pack_fact_count
  from jsonb_array_elements(coalesce(p_pack_payload -> 'entities', '[]'::jsonb)) entity;
  if p_entity_count <> v_pack_entity_count
    or p_fact_count <> v_pack_fact_count
    or p_template_count <> v_pack_template_count then
    raise exception 'Pack counts do not match the staged dataset manifest.';
  end if;

  if coalesce(cardinality(p_source_run_ids), 0) > 0 and exists (
    select 1
    from unnest(p_source_run_ids) source_run_id
    left join public.travel_source_runs source_run on source_run.id = source_run_id
    where source_run.id is null or source_run.status not in ('succeeded', 'partial')
  ) then
    raise exception 'Every artifact source run must exist and be complete.';
  end if;

  if coalesce(cardinality(p_review_candidate_ids), 0) <> coalesce(cardinality(p_review_decision_ids), 0) then
    raise exception 'Review candidate and decision provenance arrays must have equal length.';
  end if;
  if coalesce(cardinality(p_review_candidate_ids), 0) > 0 and exists (
    select 1
    from unnest(p_review_candidate_ids, p_review_decision_ids) provenance(candidate_id, decision_id)
    left join public.travel_change_candidates candidate on candidate.id = provenance.candidate_id
    left join public.travel_review_decisions decision
      on decision.id = provenance.decision_id
      and decision.candidate_id = provenance.candidate_id
    where candidate.id is null
      or candidate.status <> 'accepted'
      or decision.id is null
      or decision.decision not in ('accept', 'accept_with_edit')
  ) then
    raise exception 'Review provenance must resolve to accepted candidates and terminal accept decisions.';
  end if;

  select dataset.*
    into v_dataset_version
  from public.travel_dataset_versions dataset
  where dataset.dataset_key = v_dataset_key and dataset.version = v_version
  for update;

  if found then
    if v_dataset_version.country_code <> v_country_code
      or v_dataset_version.checksum <> p_dataset_checksum
      or v_dataset_version.entity_count <> p_entity_count
      or v_dataset_version.fact_count <> p_fact_count
      or v_dataset_version.template_count <> p_template_count then
      raise exception 'An existing dataset version cannot be restaged with different content.';
    end if;
  else
    insert into public.travel_dataset_versions (
      dataset_key, country_code, version, status, checksum,
      entity_count, fact_count, template_count, source_snapshot,
      generated_at, notes
    ) values (
      v_dataset_key, v_country_code, v_version, 'draft', p_dataset_checksum,
      p_entity_count, p_fact_count, p_template_count, p_source_snapshot,
      p_generated_at, nullif(trim(coalesce(p_notes, '')), '')
    )
    returning * into v_dataset_version;
  end if;

  select payload.*
    into v_payload
  from public.travel_dataset_payloads payload
  where payload.dataset_version_id = v_dataset_version.id and payload.locale = 'en'
  for update;
  if found then
    if v_payload.pack_checksum <> p_pack_checksum or v_payload.pack_payload <> p_pack_payload then
      raise exception 'An immutable dataset payload already exists with different content.';
    end if;
  else
    insert into public.travel_dataset_payloads (
      dataset_version_id, country_code, locale, pack_payload,
      template_copy_payload, pack_checksum, pack_byte_size,
      validation_report, status, created_by
    ) values (
      v_dataset_version.id, v_country_code, 'en', p_pack_payload,
      p_template_copy_payload, p_pack_checksum, p_pack_byte_size,
      p_validation_report, 'staged', v_uid
    )
    returning * into v_payload;
  end if;

  select active_dataset.dataset_version_id
    into v_parent_dataset_version_id
  from public.travel_active_datasets active_dataset
  where active_dataset.country_code = v_country_code;
  if v_parent_dataset_version_id = v_dataset_version.id then
    v_parent_dataset_version_id := null;
  end if;

  select artifact.*
    into v_artifact
  from public.travel_dataset_artifacts artifact
  where artifact.dataset_version_id = v_dataset_version.id
    and artifact.artifact_checksum = p_artifact_checksum
  for update;
  if found then
    return query
    select v_dataset_version.id, v_payload.id, v_artifact.id, v_artifact.status, true;
    return;
  end if;

  insert into public.travel_dataset_artifacts (
    dataset_version_id, parent_dataset_version_id, repository_commit,
    source_run_ids, review_candidate_ids, review_decision_ids,
    pack_checksum, seed_checksum, artifact_checksum, storage_object_key,
    validation_report, status, created_by
  ) values (
    v_dataset_version.id, v_parent_dataset_version_id, p_repository_commit,
    coalesce(p_source_run_ids, '{}'), coalesce(p_review_candidate_ids, '{}'), coalesce(p_review_decision_ids, '{}'),
    p_pack_checksum, p_seed_checksum, p_artifact_checksum, trim(p_storage_object_key),
    p_validation_report, 'staged', v_uid
  )
  returning * into v_artifact;

  return query
  select v_dataset_version.id, v_payload.id, v_artifact.id, v_artifact.status, false;
end;
$$;

drop function if exists public.admin_publish_travel_dataset_artifact(uuid, text);
create or replace function public.admin_publish_travel_dataset_artifact(
  p_artifact_id uuid,
  p_reason text
)
returns table(
  country_code text,
  dataset_version_id uuid,
  artifact_id uuid,
  activation_id uuid,
  activated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
  v_service_role boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  v_actor_kind text;
  v_artifact public.travel_dataset_artifacts%rowtype;
  v_dataset public.travel_dataset_versions%rowtype;
  v_payload public.travel_dataset_payloads%rowtype;
  v_previous public.travel_active_datasets%rowtype;
  v_activation_id uuid;
  v_activated_at timestamptz := now();
begin
  if not v_service_role and (
    v_uid is null
    or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    or not public.is_admin(v_uid)
  ) then
    raise exception 'Admin or service-role access required.';
  end if;
  v_actor_kind := case when v_service_role then 'service_role' else 'admin' end;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'A publish reason is required.';
  end if;

  select artifact.* into v_artifact
  from public.travel_dataset_artifacts artifact
  where artifact.id = p_artifact_id;
  if not found then raise exception 'Travel dataset artifact not found.'; end if;
  select dataset.* into v_dataset
  from public.travel_dataset_versions dataset
  where dataset.id = v_artifact.dataset_version_id;

  perform pg_advisory_xact_lock(hashtextextended('travel-dataset:' || v_dataset.country_code, 0));
  select artifact.* into v_artifact
  from public.travel_dataset_artifacts artifact
  where artifact.id = p_artifact_id
  for update;
  select dataset.* into v_dataset
  from public.travel_dataset_versions dataset
  where dataset.id = v_artifact.dataset_version_id
  for update;
  select payload.* into v_payload
  from public.travel_dataset_payloads payload
  where payload.dataset_version_id = v_dataset.id and payload.locale = 'en'
  for update;

  if v_artifact.status <> 'staged' then
    raise exception 'Only a staged artifact can be published.';
  end if;
  if v_payload.id is null
    or v_payload.pack_checksum <> v_artifact.pack_checksum
    or not coalesce((v_payload.validation_report ->> 'passed')::boolean, false) then
    raise exception 'The staged payload is missing or failed validation.';
  end if;

  select active_dataset.* into v_previous
  from public.travel_active_datasets active_dataset
  where active_dataset.country_code = v_dataset.country_code
  for update;

  if v_previous.artifact_id is not null and v_previous.artifact_id <> v_artifact.id then
    if v_artifact.parent_dataset_version_id is not null
      and v_artifact.parent_dataset_version_id <> v_previous.dataset_version_id then
      raise exception 'The staged artifact was built from a stale active dataset.';
    end if;
    update public.travel_dataset_artifacts
       set status = 'superseded', superseded_at = v_activated_at
     where id = v_previous.artifact_id and status = 'published';
    update public.travel_dataset_payloads as previous_payload
       set status = 'retired'
     where previous_payload.dataset_version_id = v_previous.dataset_version_id;
    update public.travel_dataset_versions
       set status = 'retired'
     where id = v_previous.dataset_version_id;
  end if;

  update public.travel_dataset_versions
     set status = 'published', published_at = coalesce(published_at, v_activated_at)
   where id = v_dataset.id;
  update public.travel_dataset_payloads
     set status = 'published'
   where id = v_payload.id;
  update public.travel_dataset_artifacts
     set status = 'published', published_at = v_activated_at,
         superseded_at = null, rolled_back_at = null
   where id = v_artifact.id;

  insert into public.travel_active_datasets (
    country_code, dataset_version_id, artifact_id, activated_by, activated_at
  ) values (
    v_dataset.country_code, v_dataset.id, v_artifact.id, v_uid, v_activated_at
  )
  on conflict on constraint travel_active_datasets_pkey do update
  set dataset_version_id = excluded.dataset_version_id,
      artifact_id = excluded.artifact_id,
      activated_by = excluded.activated_by,
      activated_at = excluded.activated_at;

  insert into public.travel_dataset_activations (
    country_code, action, from_dataset_version_id, from_artifact_id,
    to_dataset_version_id, to_artifact_id, reason, activated_by, actor_kind,
    metadata
  ) values (
    v_dataset.country_code, 'publish', v_previous.dataset_version_id, v_previous.artifact_id,
    v_dataset.id, v_artifact.id, trim(p_reason), v_uid, v_actor_kind,
    jsonb_build_object('repositoryCommit', v_artifact.repository_commit)
  )
  returning id into v_activation_id;

  return query
  select v_dataset.country_code, v_dataset.id, v_artifact.id, v_activation_id, v_activated_at;
end;
$$;

drop function if exists public.admin_rollback_travel_dataset(text, uuid, text);
create or replace function public.admin_rollback_travel_dataset(
  p_country_code text,
  p_target_artifact_id uuid,
  p_reason text
)
returns table(
  country_code text,
  dataset_version_id uuid,
  artifact_id uuid,
  activation_id uuid,
  activated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
  v_service_role boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  v_actor_kind text;
  v_country_code text := upper(trim(coalesce(p_country_code, '')));
  v_current public.travel_active_datasets%rowtype;
  v_target_artifact public.travel_dataset_artifacts%rowtype;
  v_target_dataset public.travel_dataset_versions%rowtype;
  v_target_payload public.travel_dataset_payloads%rowtype;
  v_activation_id uuid;
  v_activated_at timestamptz := now();
begin
  if not v_service_role and (
    v_uid is null
    or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    or not public.is_admin(v_uid)
  ) then
    raise exception 'Admin or service-role access required.';
  end if;
  v_actor_kind := case when v_service_role then 'service_role' else 'admin' end;
  if v_country_code !~ '^[A-Z]{2}$' or nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'A valid country code and rollback reason are required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('travel-dataset:' || v_country_code, 0));
  select active_dataset.* into v_current
  from public.travel_active_datasets active_dataset
  where active_dataset.country_code = v_country_code
  for update;
  if v_current.artifact_id is null then raise exception 'No active dataset exists for this country.'; end if;
  if v_current.artifact_id = p_target_artifact_id then raise exception 'The target artifact is already active.'; end if;

  select artifact.* into v_target_artifact
  from public.travel_dataset_artifacts artifact
  where artifact.id = p_target_artifact_id
  for update;
  if found then
    select dataset.* into v_target_dataset
    from public.travel_dataset_versions dataset
    where dataset.id = v_target_artifact.dataset_version_id
      and dataset.country_code = v_country_code
    for update;
  end if;
  if not found then raise exception 'Rollback artifact not found for this country.'; end if;
  if v_target_artifact.status not in ('superseded', 'rolled_back') then
    raise exception 'Only a previously published artifact can be restored.';
  end if;

  select payload.* into v_target_payload
  from public.travel_dataset_payloads payload
  where payload.dataset_version_id = v_target_dataset.id and payload.locale = 'en'
  for update;
  if v_target_payload.id is null
    or v_target_payload.pack_checksum <> v_target_artifact.pack_checksum
    or not coalesce((v_target_payload.validation_report ->> 'passed')::boolean, false) then
    raise exception 'The rollback payload is missing or failed validation.';
  end if;

  update public.travel_dataset_artifacts
     set status = 'rolled_back', rolled_back_at = v_activated_at
   where id = v_current.artifact_id and status = 'published';
  update public.travel_dataset_payloads as current_payload
     set status = 'retired'
   where current_payload.dataset_version_id = v_current.dataset_version_id;
  update public.travel_dataset_versions
     set status = 'retired'
   where id = v_current.dataset_version_id;

  update public.travel_dataset_artifacts
     set status = 'published', superseded_at = null, rolled_back_at = null
   where id = v_target_artifact.id;
  update public.travel_dataset_payloads
     set status = 'published'
   where id = v_target_payload.id;
  update public.travel_dataset_versions
     set status = 'published', published_at = coalesce(published_at, v_activated_at)
   where id = v_target_dataset.id;
  update public.travel_active_datasets active_dataset
     set dataset_version_id = v_target_dataset.id,
         artifact_id = v_target_artifact.id,
         activated_by = v_uid,
         activated_at = v_activated_at
   where active_dataset.country_code = v_country_code;

  insert into public.travel_dataset_activations (
    country_code, action, from_dataset_version_id, from_artifact_id,
    to_dataset_version_id, to_artifact_id, reason, activated_by, actor_kind,
    metadata
  ) values (
    v_country_code, 'rollback', v_current.dataset_version_id, v_current.artifact_id,
    v_target_dataset.id, v_target_artifact.id, trim(p_reason), v_uid, v_actor_kind,
    jsonb_build_object('restoredRepositoryCommit', v_target_artifact.repository_commit)
  )
  returning id into v_activation_id;

  return query
  select v_country_code, v_target_dataset.id, v_target_artifact.id, v_activation_id, v_activated_at;
end;
$$;

revoke all on function public.admin_stage_travel_dataset_artifact(
  text, text, text, text, integer, integer, integer, jsonb, timestamptz, text,
  text, uuid[], uuid[], uuid[], jsonb, jsonb, text, text, text, text, bigint, jsonb
) from public, anon, authenticated;
revoke all on function public.admin_publish_travel_dataset_artifact(uuid, text) from public, anon;
revoke all on function public.admin_rollback_travel_dataset(text, uuid, text) from public, anon;

grant execute on function public.admin_stage_travel_dataset_artifact(
  text, text, text, text, integer, integer, integer, jsonb, timestamptz, text,
  text, uuid[], uuid[], uuid[], jsonb, jsonb, text, text, text, text, bigint, jsonb
) to authenticated, service_role;
grant execute on function public.admin_publish_travel_dataset_artifact(uuid, text) to authenticated, service_role;
grant execute on function public.admin_rollback_travel_dataset(text, uuid, text) to authenticated, service_role;

drop function if exists public.get_travel_entity_suggestions(text, text, text[], integer);
create or replace function public.get_travel_entity_suggestions(
  p_query text,
  p_country_code text default null,
  p_entity_types text[] default array['city', 'neighborhood']::text[],
  p_limit integer default 20
)
returns table(
  id uuid,
  canonical_slug text,
  entity_type text,
  country_code text,
  primary_name text,
  local_name text,
  parent_id uuid,
  parent_slug text,
  latitude double precision,
  longitude double precision,
  popularity_score numeric
)
language sql
stable
set search_path = public
as $$
  with normalized as (
    select lower(trim(coalesce(p_query, ''))) as query
  ),
  matched as (
    select distinct entity.id
    from public.travel_entities entity
    cross join normalized
    left join public.travel_entity_names entity_name on entity_name.entity_id = entity.id
    where entity.status = 'published'
      and (p_country_code is null or entity.country_code = upper(trim(p_country_code)))
      and (coalesce(array_length(p_entity_types, 1), 0) = 0 or entity.entity_type = any(p_entity_types))
      and (
        normalized.query = ''
        or lower(entity.primary_name) like '%' || normalized.query || '%'
        or lower(coalesce(entity.local_name, '')) like '%' || normalized.query || '%'
        or lower(coalesce(entity_name.name, '')) like '%' || normalized.query || '%'
      )
  )
  select
    entity.id,
    entity.canonical_slug,
    entity.entity_type,
    entity.country_code,
    entity.primary_name,
    entity.local_name,
    entity.parent_id,
    parent.canonical_slug as parent_slug,
    entity.latitude,
    entity.longitude,
    entity.popularity_score
  from matched
  join public.travel_entities entity on entity.id = matched.id
  left join public.travel_entities parent on parent.id = entity.parent_id
  order by entity.popularity_score desc, entity.primary_name asc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

grant execute on function public.get_travel_entity_suggestions(text, text, text[], integer) to anon, authenticated;

drop function if exists public.get_travel_destination_pack(text, text);
create or replace function public.get_travel_destination_pack(
  p_country_code text,
  p_locale text default 'en'
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with selected_entities as (
    select entity.*
    from public.travel_entities entity
    where entity.country_code = upper(trim(p_country_code))
      and entity.status = 'published'
  ),
  selected_templates as (
    select template.*
    from public.travel_templates template
    where template.country_code = upper(trim(p_country_code))
      and template.status = 'published'
  )
  select jsonb_build_object(
    'countryCode', upper(trim(p_country_code)),
    'locale', coalesce(nullif(trim(p_locale), ''), 'en'),
    'dataset', coalesce(
      (
        select to_jsonb(dataset) - 'created_at' - 'updated_at'
        from public.travel_dataset_versions dataset
        where dataset.country_code = upper(trim(p_country_code))
          and dataset.status = 'published'
        order by dataset.published_at desc nulls last, dataset.generated_at desc
        limit 1
      ),
      '{}'::jsonb
    ),
    'entities', coalesce(
      (
        select jsonb_agg(
          (to_jsonb(entity) - 'created_at' - 'updated_at')
          || jsonb_build_object(
            'names', coalesce(
              (
                select jsonb_agg(to_jsonb(entity_name) - 'id' - 'entity_id' - 'created_at' order by entity_name.is_preferred desc, entity_name.name asc)
                from public.travel_entity_names entity_name
                where entity_name.entity_id = entity.id
              ),
              '[]'::jsonb
            ),
            'facts', coalesce(
              (
                select jsonb_agg(
                  (to_jsonb(fact) - 'entity_id' - 'created_at' - 'updated_at')
                  || jsonb_build_object('sourceKey', source.source_key)
                  order by fact.fact_key asc, fact.observed_at desc
                )
                from public.travel_entity_facts fact
                join public.travel_sources source on source.id = fact.source_id
                where fact.entity_id = entity.id
                  and fact.is_public = true
                  and fact.review_status in ('editorial_reviewed', 'verified')
                  and (fact.valid_until is null or fact.valid_until > now())
                  and (fact.locale is null or fact.locale = coalesce(nullif(trim(p_locale), ''), 'en'))
              ),
              '[]'::jsonb
            ),
            'tags', coalesce(
              (
                select jsonb_agg(
                  (to_jsonb(entity_tag) - 'entity_id' - 'source_id' - 'created_at' - 'updated_at')
                  || jsonb_build_object('sourceKey', source.source_key)
                  order by entity_tag.relevance desc, entity_tag.tag_key asc
                )
                from public.travel_entity_tags entity_tag
                join public.travel_sources source on source.id = entity_tag.source_id
                where entity_tag.entity_id = entity.id
                  and entity_tag.is_public = true
                  and entity_tag.evidence_level in ('official', 'editorial', 'community', 'self_attested')
                  and (entity_tag.valid_until is null or entity_tag.valid_until > now())
              ),
              '[]'::jsonb
            )
          )
          order by entity.entity_type asc, entity.popularity_score desc, entity.primary_name asc
        )
        from selected_entities entity
      ),
      '[]'::jsonb
    ),
    'templates', coalesce(
      (
        select jsonb_agg(
          (to_jsonb(template) - 'created_at' - 'updated_at')
          || jsonb_build_object(
            'copy', coalesce(
              (
                select to_jsonb(template_copy) - 'template_id' - 'created_at' - 'updated_at'
                from public.travel_template_copy template_copy
                where template_copy.template_id = template.id
                order by (template_copy.locale = coalesce(nullif(trim(p_locale), ''), 'en')) desc,
                         (template_copy.locale = 'en') desc
                limit 1
              ),
              '{}'::jsonb
            ),
            'stops', coalesce(
              (
                select jsonb_agg(
                  (to_jsonb(template_stop) - 'template_id' - 'entity_id' - 'created_at' - 'updated_at')
                  || jsonb_build_object(
                    'entityId', entity.id,
                    'entitySlug', entity.canonical_slug,
                    'entityName', entity.primary_name,
                    'entityType', entity.entity_type
                  )
                  order by template_stop.sequence asc
                )
                from public.travel_template_stops template_stop
                join public.travel_entities entity on entity.id = template_stop.entity_id
                where template_stop.template_id = template.id
              ),
              '[]'::jsonb
            ),
            'legs', coalesce(
              (
                select jsonb_agg(
                  (to_jsonb(template_leg) - 'template_id' - 'from_entity_id' - 'to_entity_id' - 'source_id' - 'created_at' - 'updated_at')
                  || jsonb_build_object(
                    'fromEntityId', from_entity.id,
                    'fromEntitySlug', from_entity.canonical_slug,
                    'fromEntityName', from_entity.primary_name,
                    'toEntityId', to_entity.id,
                    'toEntitySlug', to_entity.canonical_slug,
                    'toEntityName', to_entity.primary_name,
                    'sourceKey', source.source_key
                  )
                  order by template_leg.sequence asc
                )
                from public.travel_template_legs template_leg
                join public.travel_entities from_entity on from_entity.id = template_leg.from_entity_id
                join public.travel_entities to_entity on to_entity.id = template_leg.to_entity_id
                join public.travel_sources source on source.id = template_leg.source_id
                where template_leg.template_id = template.id
                  and (template_leg.valid_until is null or template_leg.valid_until > now())
              ),
              '[]'::jsonb
            ),
            'tags', coalesce(
              (
                select jsonb_agg(to_jsonb(template_tag) - 'template_id' - 'created_at' order by template_tag.weight desc, template_tag.tag_key asc)
                from public.travel_template_tags template_tag
                where template_tag.template_id = template.id
              ),
              '[]'::jsonb
            )
          )
          order by template.min_days asc, template.template_key asc
        )
        from selected_templates template
      ),
      '[]'::jsonb
    )
  );
$$;

grant execute on function public.get_travel_destination_pack(text, text) to anon, authenticated;

drop function if exists public.get_active_travel_destination_pack(text, text);
create or replace function public.get_active_travel_destination_pack(
  p_country_code text,
  p_locale text default 'en'
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with requested as (
    select
      upper(trim(p_country_code)) as country_code,
      lower(coalesce(nullif(trim(p_locale), ''), 'en')) as locale,
      split_part(lower(coalesce(nullif(trim(p_locale), ''), 'en')), '-', 1) as primary_locale
  ),
  active_payload as (
    select payload.pack_payload, payload.template_copy_payload
    from public.travel_active_datasets active_dataset
    join public.travel_dataset_payloads payload
      on payload.dataset_version_id = active_dataset.dataset_version_id
     and payload.country_code = active_dataset.country_code
     and payload.locale = 'en'
     and payload.status = 'published'
    cross join requested
    where active_dataset.country_code = requested.country_code
    limit 1
  ),
  localized_payload as (
    select
      jsonb_set(
        jsonb_set(
          active_payload.pack_payload,
          '{locale}',
          to_jsonb(requested.locale),
          true
        ),
        '{templates}',
        coalesce(
          (
            select jsonb_agg(
              template.value || jsonb_build_object(
                'copy',
                coalesce(
                  active_payload.template_copy_payload #> array['templates', template.value ->> 'templateKey', requested.locale],
                  active_payload.template_copy_payload #> array['templates', template.value ->> 'templateKey', requested.primary_locale],
                  active_payload.template_copy_payload #> array['templates', template.value ->> 'templateKey', 'en'],
                  template.value -> 'copy'
                )
              )
              order by template.ordinality
            )
            from jsonb_array_elements(coalesce(active_payload.pack_payload -> 'templates', '[]'::jsonb))
              with ordinality as template(value, ordinality)
          ),
          '[]'::jsonb
        ),
        true
      ) as pack_payload
    from active_payload
    cross join requested
  )
  select coalesce(
    (select localized_payload.pack_payload from localized_payload),
    '{}'::jsonb
  );
$$;

drop function if exists public.get_active_travel_entity_suggestions(text, text, text[], integer);
create or replace function public.get_active_travel_entity_suggestions(
  p_query text,
  p_country_code text default null,
  p_entity_types text[] default array['city', 'neighborhood']::text[],
  p_limit integer default 20
)
returns table(
  id uuid,
  canonical_slug text,
  entity_type text,
  country_code text,
  primary_name text,
  local_name text,
  parent_id uuid,
  parent_slug text,
  latitude double precision,
  longitude double precision,
  popularity_score numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with requested as (
    select
      lower(trim(coalesce(p_query, ''))) as query,
      case when p_country_code is null then null else upper(trim(p_country_code)) end as country_code
  ),
  active_entities as (
    select
      entity.value as entity,
      payload.pack_payload -> 'entities' as all_entities
    from public.travel_active_datasets active_dataset
    join public.travel_dataset_payloads payload
      on payload.dataset_version_id = active_dataset.dataset_version_id
     and payload.country_code = active_dataset.country_code
     and payload.locale = 'en'
     and payload.status = 'published'
    cross join requested
    cross join lateral jsonb_array_elements(coalesce(payload.pack_payload -> 'entities', '[]'::jsonb)) entity(value)
    where requested.country_code is null or active_dataset.country_code = requested.country_code
  ),
  matches as (
    select active_entities.*
    from active_entities
    cross join requested
    where (
      coalesce(array_length(p_entity_types, 1), 0) = 0
      or active_entities.entity ->> 'entityType' = any(p_entity_types)
    )
    and (
      requested.query = ''
      or lower(active_entities.entity ->> 'name') like '%' || requested.query || '%'
      or lower(coalesce(active_entities.entity ->> 'localName', '')) like '%' || requested.query || '%'
      or exists (
        select 1
        from jsonb_array_elements(coalesce(active_entities.entity -> 'names', '[]'::jsonb)) entity_name
        where lower(entity_name ->> 'name') like '%' || requested.query || '%'
      )
    )
  )
  select active_matches.*
  from (
    select
      (matches.entity ->> 'entityId')::uuid as id,
      matches.entity ->> 'canonicalSlug' as canonical_slug,
      matches.entity ->> 'entityType' as entity_type,
      matches.entity ->> 'countryCode' as country_code,
      matches.entity ->> 'name' as primary_name,
      nullif(matches.entity ->> 'localName', '') as local_name,
      nullif(matches.entity ->> 'parentId', '')::uuid as parent_id,
      (
        select parent ->> 'canonicalSlug'
        from jsonb_array_elements(coalesce(matches.all_entities, '[]'::jsonb)) parent
        where parent ->> 'entityId' = matches.entity ->> 'parentId'
        limit 1
      ) as parent_slug,
      nullif(matches.entity ->> 'latitude', '')::double precision as latitude,
      nullif(matches.entity ->> 'longitude', '')::double precision as longitude,
      coalesce(nullif(matches.entity ->> 'popularityScore', '')::numeric, 0) as popularity_score
    from matches
    order by
      coalesce(nullif(matches.entity ->> 'popularityScore', '')::numeric, 0) desc,
      matches.entity ->> 'name' asc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  ) active_matches
  order by popularity_score desc, primary_name asc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

drop function if exists public.get_active_travel_planning_context(
  text, text, text, integer, integer[], text, text[], text[], text[], text[],
  integer, text[], integer, integer, integer
);
create or replace function public.get_active_travel_planning_context(
  p_country_code text,
  p_locale text default 'en',
  p_journey_type text default 'single_country_circuit',
  p_duration_days integer default 7,
  p_months integer[] default array[]::integer[],
  p_pace text default 'balanced',
  p_interest_tags text[] default array[]::text[],
  p_selected_place_slugs text[] default array[]::text[],
  p_locked_place_slugs text[] default array[]::text[],
  p_avoided_place_slugs text[] default array[]::text[],
  p_max_base_changes integer default null,
  p_template_keys text[] default array[]::text[],
  p_template_limit integer default 3,
  p_neighborhood_limit_per_city integer default 2,
  p_poi_limit_per_city integer default 2
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive requested as (
    select
      upper(trim(p_country_code)) as country_code,
      lower(coalesce(nullif(trim(p_locale), ''), 'en')) as locale,
      trim(p_journey_type) as journey_type,
      greatest(1, least(coalesce(p_duration_days, 7), 365)) as duration_days,
      case when trim(p_pace) in ('relaxed', 'balanced', 'full') then trim(p_pace) else 'balanced' end as pace,
      array(select distinct value from unnest(coalesce(p_months, array[]::integer[])) value where value between 1 and 12) as months,
      array(select distinct lower(trim(value)) from unnest(coalesce(p_interest_tags, array[]::text[])) value where trim(value) <> '') as interest_tags,
      array(select distinct lower(trim(value)) from unnest(coalesce(p_selected_place_slugs, array[]::text[])) value where trim(value) <> '') as selected_slugs,
      array(select distinct lower(trim(value)) from unnest(coalesce(p_locked_place_slugs, array[]::text[])) value where trim(value) <> '') as locked_slugs,
      array(select distinct lower(trim(value)) from unnest(coalesce(p_avoided_place_slugs, array[]::text[])) value where trim(value) <> '') as avoided_slugs,
      case when p_max_base_changes is null then null else greatest(0, p_max_base_changes) end as max_base_changes,
      array(select distinct lower(trim(value)) from unnest(coalesce(p_template_keys, array[]::text[])) value where trim(value) <> '') as template_keys,
      greatest(1, least(coalesce(p_template_limit, 3), 10)) as template_limit,
      greatest(1, least(coalesce(p_neighborhood_limit_per_city, 2), 10)) as neighborhood_limit,
      greatest(1, least(coalesce(p_poi_limit_per_city, 2), 12)) as poi_limit
  ),
  source_pack as (
    select public.get_active_travel_destination_pack(requested.country_code, requested.locale) as pack
    from requested
  ),
  entity_rows as (
    select entity.value as entity, entity.ordinality
    from source_pack
    cross join lateral jsonb_array_elements(coalesce(source_pack.pack -> 'entities', '[]'::jsonb))
      with ordinality as entity(value, ordinality)
  ),
  template_rows as (
    select template.value as template, template.ordinality
    from source_pack
    cross join lateral jsonb_array_elements(coalesce(source_pack.pack -> 'templates', '[]'::jsonb))
      with ordinality as template(value, ordinality)
  ),
  route_place_ancestry(place_slug, entity, depth) as (
    select route_place.canonical_slug, entity_rows.entity, 0
    from requested
    cross join lateral (
      select distinct canonical_slug
      from unnest(requested.selected_slugs || requested.locked_slugs) as route_slug(canonical_slug)
    ) route_place
    join entity_rows on entity_rows.entity ->> 'canonicalSlug' = route_place.canonical_slug
    union all
    select route_place_ancestry.place_slug, parent.entity, route_place_ancestry.depth + 1
    from route_place_ancestry
    join entity_rows parent on parent.entity ->> 'entityId' = route_place_ancestry.entity ->> 'parentId'
    where route_place_ancestry.depth < 8
  ),
  template_metrics as (
    select
      template_rows.*,
      array(
        select stop ->> 'entitySlug'
        from jsonb_array_elements(coalesce(template_rows.template -> 'stops', '[]'::jsonb)) stop
      ) as stop_slugs,
      greatest(
        0,
        (
          select count(distinct stop ->> 'entitySlug')::integer
          from jsonb_array_elements(coalesce(template_rows.template -> 'stops', '[]'::jsonb)) stop
          where stop ->> 'stopRole' = 'base'
            and coalesce((stop ->> 'isOptional')::boolean, false) = false
        ) - 1
      ) as base_changes,
      case
        when (template_rows.template ->> 'minDays')::integer > requested.duration_days
          then (template_rows.template ->> 'minDays')::integer - requested.duration_days
        when (template_rows.template ->> 'maxDays')::integer < requested.duration_days
          then requested.duration_days - (template_rows.template ->> 'maxDays')::integer
        else 0
      end as duration_delta,
      coalesce(
        (
          select sum((tag ->> 'weight')::numeric)
          from jsonb_array_elements(coalesce(template_rows.template -> 'tags', '[]'::jsonb)) tag
          where tag ->> 'tagKey' = any(requested.interest_tags)
        ),
        0
      ) as matching_tag_weight,
      coalesce(
        (
          select count(*)::numeric
          from unnest(requested.selected_slugs) as selected_place(canonical_slug)
          where exists (
            select 1
            from route_place_ancestry
            where route_place_ancestry.place_slug = selected_place.canonical_slug
              and (
                route_place_ancestry.depth = 0
                or route_place_ancestry.entity ->> 'entityType' = 'city'
              )
              and route_place_ancestry.entity ->> 'canonicalSlug' = any(array(
                select stop ->> 'entitySlug'
                from jsonb_array_elements(coalesce(template_rows.template -> 'stops', '[]'::jsonb)) stop
              ))
          )
        ),
        0
      ) as selected_match_count,
      coalesce(
        (
          select count(*)::numeric
          from unnest(requested.months) month
          where month = any(array(
            select (ideal_month)::integer
            from jsonb_array_elements_text(coalesce(template_rows.template -> 'idealMonths', '[]'::jsonb)) ideal_month
          ))
        ),
        0
      ) as month_match_count
    from template_rows
    cross join requested
  ),
  eligible_templates as (
    select
      template_metrics.*,
      (
        greatest(0, 35 - (template_metrics.duration_delta * 6))
        + case
            when template_metrics.template ->> 'preferredPace' = requested.pace then 15
            when abs(
              array_position(array['relaxed', 'balanced', 'full']::text[], template_metrics.template ->> 'preferredPace')
              - array_position(array['relaxed', 'balanced', 'full']::text[], requested.pace)
            ) = 1 then 8
            else 2
          end
        + case
            when cardinality(requested.months) = 0 then 8
            else 15 * (template_metrics.month_match_count / greatest(1, cardinality(requested.months)))
          end
        + case
            when cardinality(requested.interest_tags) = 0 then 12
            else least(25, template_metrics.matching_tag_weight * 10)
          end
        + case
            when cardinality(requested.selected_slugs) = 0 then 5
            else 10 * (template_metrics.selected_match_count / greatest(1, cardinality(requested.selected_slugs)))
          end
      )::numeric as retrieval_score
    from template_metrics
    cross join requested
    where template_metrics.template ->> 'journeyType' = requested.journey_type
      and (requested.max_base_changes is null or template_metrics.base_changes <= requested.max_base_changes)
      and (
        cardinality(requested.template_keys) = 0
        or template_metrics.template ->> 'templateKey' = any(requested.template_keys)
      )
      and not exists (
        select 1
        from unnest(requested.avoided_slugs) avoided_slug
        where avoided_slug = any(template_metrics.stop_slugs)
      )
      and not exists (
        select 1
        from unnest(requested.locked_slugs) as locked_place(canonical_slug)
        where not exists (
          select 1
          from route_place_ancestry
          where route_place_ancestry.place_slug = locked_place.canonical_slug
            and (
              route_place_ancestry.depth = 0
              or route_place_ancestry.entity ->> 'entityType' = 'city'
            )
            and route_place_ancestry.entity ->> 'canonicalSlug' = any(template_metrics.stop_slugs)
        )
      )
  ),
  ranked_templates as (
    select
      eligible_templates.*,
      row_number() over (
        order by
          case
            when cardinality(requested.template_keys) > 0
              then array_position(requested.template_keys, eligible_templates.template ->> 'templateKey')
            else null
          end asc nulls last,
          eligible_templates.retrieval_score desc,
          eligible_templates.duration_delta asc,
          eligible_templates.template ->> 'templateKey' asc
      ) as retrieval_rank
    from eligible_templates
    cross join requested
  ),
  selected_templates as (
    select ranked_templates.*
    from ranked_templates
    cross join requested
    where ranked_templates.retrieval_rank <= case
      when cardinality(requested.template_keys) > 0 then cardinality(requested.template_keys)
      else requested.template_limit
    end
  ),
  selected_stop_slugs as (
    select distinct stop ->> 'entitySlug' as canonical_slug
    from selected_templates
    cross join lateral jsonb_array_elements(coalesce(selected_templates.template -> 'stops', '[]'::jsonb)) stop
  ),
  seed_slugs as (
    select canonical_slug from selected_stop_slugs
    union
    select unnest(requested.selected_slugs) from requested
    union
    select unnest(requested.locked_slugs) from requested
    union
    select entity_rows.entity ->> 'canonicalSlug'
    from entity_rows
    cross join requested
    where entity_rows.entity ->> 'entityType' = 'country'
      and entity_rows.entity ->> 'countryCode' = requested.country_code
  ),
  ancestry(entity, ordinality, depth) as (
    select entity_rows.entity, entity_rows.ordinality, 0
    from entity_rows
    join seed_slugs on seed_slugs.canonical_slug = entity_rows.entity ->> 'canonicalSlug'
    union
    select parent.entity, parent.ordinality, ancestry.depth + 1
    from ancestry
    join entity_rows parent on parent.entity ->> 'entityId' = ancestry.entity ->> 'parentId'
    where ancestry.depth < 8
  ),
  city_anchors as (
    select distinct ancestry.entity, ancestry.ordinality
    from ancestry
    where ancestry.entity ->> 'entityType' = 'city'
  ),
  descendants(entity, ordinality, root_city_id, depth) as (
    select city_anchors.entity, city_anchors.ordinality, city_anchors.entity ->> 'entityId', 0
    from city_anchors
    union all
    select child.entity, child.ordinality, descendants.root_city_id, descendants.depth + 1
    from descendants
    join entity_rows child on child.entity ->> 'parentId' = descendants.entity ->> 'entityId'
    where descendants.depth < 8
  ),
  ranked_descendants as (
    select
      descendants.*,
      row_number() over (
        partition by descendants.root_city_id, descendants.entity ->> 'entityType'
        order by
          ((descendants.entity ->> 'canonicalSlug') in (select canonical_slug from seed_slugs)) desc,
          coalesce(
            (
              select sum(coalesce((tag ->> 'relevance')::numeric, 0))
              from jsonb_array_elements(coalesce(descendants.entity -> 'tags', '[]'::jsonb)) tag
              cross join requested
              where tag ->> 'tagKey' = any(requested.interest_tags)
            ),
            0
          ) desc,
          coalesce((descendants.entity ->> 'popularityScore')::numeric, 0) desc,
          coalesce((descendants.entity ->> 'hiddenGemScore')::numeric, 0) desc,
          descendants.entity ->> 'canonicalSlug' asc
      ) as type_rank
    from descendants
  ),
  selected_entity_slugs as (
    select distinct ancestry.entity ->> 'canonicalSlug' as canonical_slug from ancestry
    union
    select distinct ranked_descendants.entity ->> 'canonicalSlug'
    from ranked_descendants
    cross join requested
    where (
      ranked_descendants.entity ->> 'entityType' = 'neighborhood'
      and ranked_descendants.type_rank <= requested.neighborhood_limit
    ) or (
      ranked_descendants.entity ->> 'entityType' = 'poi'
      and ranked_descendants.type_rank <= requested.poi_limit
    )
  ),
  compact_entities as (
    select
      entity_rows.ordinality,
      (entity_rows.entity - 'attributes' - 'names' - 'facts' - 'tags')
      || jsonb_build_object(
        'attributes', coalesce(entity_rows.entity -> 'attributes', '{}'::jsonb) - 'sourceUrls',
        'names', coalesce(
          (
            select jsonb_agg(name order by name ->> 'locale', name ->> 'name')
            from jsonb_array_elements(coalesce(entity_rows.entity -> 'names', '[]'::jsonb)) name
            where coalesce((name ->> 'isPreferred')::boolean, false) = true
          ),
          '[]'::jsonb
        ),
        'facts', coalesce(
          (
            select jsonb_agg(
              (fact - 'metadata') || jsonb_build_object(
                'metadata',
                case
                  when fact ->> 'factKey' = 'summary'
                    and nullif(fact #>> '{metadata,sourceUrl}', '') is not null
                    then jsonb_build_object('sourceUrl', fact #>> '{metadata,sourceUrl}')
                  else '{}'::jsonb
                end
              )
              order by fact ->> 'factKey', fact ->> 'observedAt' desc
            )
            from jsonb_array_elements(coalesce(entity_rows.entity -> 'facts', '[]'::jsonb)) fact
            where fact ->> 'factKey' = any(array[
              'summary',
              'season.best_months',
              'season.caution',
              'transport.summary',
              'food.signature_dishes',
              'cost.relative_level',
              'stay.recommended_days',
              'visit.duration_minutes',
              'visit.best_time',
              'visit.weather_dependency',
              'visit.physical_intensity',
              'access.transport',
              'audience.family_fit',
              'audience.lgbtq_fit',
              'audience.solo_fit',
              'audience.mobility_fit'
            ]::text[])
              and (
                entity_rows.entity ->> 'entityType' <> 'poi'
                or cardinality((select requested.template_keys from requested)) > 0
                or fact ->> 'factKey' = any(array['summary', 'visit.duration_minutes']::text[])
              )
          ),
          '[]'::jsonb
        ),
        'tags', coalesce(
          (
            select jsonb_agg(
              case
                when tag ->> 'tagKey' = any(array['family_activity_supply', 'lgbtq_scene', 'solo_travel_interest']::text[])
                  then tag
                else (tag - 'evidenceNote' - 'metadata') || jsonb_build_object('metadata', '{}'::jsonb)
              end
              order by coalesce((tag ->> 'relevance')::numeric, 0) desc, tag ->> 'tagKey'
            )
            from jsonb_array_elements(coalesce(entity_rows.entity -> 'tags', '[]'::jsonb)) tag
          ),
          '[]'::jsonb
        )
      ) as entity
    from entity_rows
    join selected_entity_slugs on selected_entity_slugs.canonical_slug = entity_rows.entity ->> 'canonicalSlug'
  ),
  selected_stats as (
    select
      count(*)::integer as entity_count,
      count(*) filter (where compact_entities.entity ->> 'entityType' = 'city')::integer as city_count,
      count(*) filter (where compact_entities.entity ->> 'entityType' = 'neighborhood')::integer as neighborhood_count,
      count(*) filter (where compact_entities.entity ->> 'entityType' = 'poi')::integer as poi_count
    from compact_entities
  )
  select jsonb_build_object(
    'version', 1,
    'retrieverVersion', 'structured-pack-v2',
    'query', jsonb_build_object(
      'countryCode', requested.country_code,
      'locale', requested.locale,
      'journeyType', requested.journey_type,
      'durationDays', requested.duration_days,
      'months', to_jsonb(requested.months),
      'pace', requested.pace,
      'interestTags', to_jsonb(requested.interest_tags),
      'selectedPlaceSlugs', to_jsonb(requested.selected_slugs),
      'lockedPlaceSlugs', to_jsonb(requested.locked_slugs),
      'avoidedPlaceSlugs', to_jsonb(requested.avoided_slugs),
      'maxBaseChanges', requested.max_base_changes,
      'templateKeys', to_jsonb(requested.template_keys),
      'templateLimit', requested.template_limit,
      'neighborhoodLimitPerCity', requested.neighborhood_limit,
      'poiLimitPerCity', requested.poi_limit
    ),
    'pack', jsonb_build_object(
      'countryCode', requested.country_code,
      'locale', requested.locale,
      'dataset', coalesce(source_pack.pack -> 'dataset', '{}'::jsonb),
      'entities', coalesce(
        (select jsonb_agg(compact_entities.entity order by compact_entities.ordinality) from compact_entities),
        '[]'::jsonb
      ),
      'templates', coalesce(
        (select jsonb_agg(selected_templates.template order by selected_templates.retrieval_rank) from selected_templates),
        '[]'::jsonb
      )
    ),
    'stats', jsonb_build_object(
      'sourceEntityCount', jsonb_array_length(coalesce(source_pack.pack -> 'entities', '[]'::jsonb)),
      'sourceTemplateCount', jsonb_array_length(coalesce(source_pack.pack -> 'templates', '[]'::jsonb)),
      'selectedEntityCount', selected_stats.entity_count,
      'selectedTemplateCount', (select count(*)::integer from selected_templates),
      'selectedCityCount', selected_stats.city_count,
      'selectedNeighborhoodCount', selected_stats.neighborhood_count,
      'selectedPoiCount', selected_stats.poi_count
    )
  )
  from requested
  cross join source_pack
  cross join selected_stats;
$$;

revoke all on function public.get_active_travel_destination_pack(text, text) from public, anon, authenticated;
revoke all on function public.get_active_travel_entity_suggestions(text, text, text[], integer) from public, anon, authenticated;
revoke all on function public.get_active_travel_planning_context(
  text, text, text, integer, integer[], text, text[], text[], text[], text[],
  integer, text[], integer, integer, integer
) from public;
revoke all on function public.get_travel_destination_pack(text, text) from public, anon, authenticated;
revoke all on function public.get_travel_entity_suggestions(text, text, text[], integer) from public, anon, authenticated;
grant execute on function public.get_active_travel_destination_pack(text, text) to anon, authenticated, service_role;
grant execute on function public.get_active_travel_entity_suggestions(text, text, text[], integer) to anon, authenticated, service_role;
grant execute on function public.get_active_travel_planning_context(
  text, text, text, integer, integer[], text, text[], text[], text[], text[],
  integer, text[], integer, integer, integer
) to anon, authenticated;

-- Final RLS sweep so any public table that exists outside the explicit table list
-- still gets locked down when this source-of-truth SQL is re-applied.
do $$
declare
  r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', r.tablename);
  end loop;
end
$$;
