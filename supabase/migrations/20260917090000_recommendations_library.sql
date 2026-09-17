-- Place recommendations: the shared library behind the Ideas deck.
--
-- Until now the library shipped as a JSON file in the repository, which made
-- every correction a deploy. This table is the maintainable home: an editor
-- adds and edits rows, publishing is a status change, and the repo file
-- becomes a seed and an offline fallback rather than the source of truth.
--
-- Writes go through the admin edge function on the service role, so RLS only
-- has to answer the read question. Anonymous travellers must be able to read a
-- published row — the deck works signed out on a shared link.

create table if not exists public.recommendations (
  -- Stable across re-imports: the importer derives it from country and slug.
  id text primary key,
  slug text not null,
  country_code text not null,
  city_name text,
  city_slug text,

  lat double precision,
  lng double precision,
  address text,
  formatted_address text,
  geocode_precision text not null default 'unknown',
  google_place_id text,
  geocoded_at text,

  locale text not null default 'en',
  title text not null,
  summary text not null default '',
  description text,
  -- Bulleted "what to do here" lines, rendered under the description.
  highlights jsonb not null default '[]'::jsonb,
  activity_types jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,

  cost_band text,
  cost_note text,
  typical_duration_minutes integer,
  best_time_of_day jsonb,

  -- A reference to a provider photo plus its attribution. The bytes are never
  -- copied; `/api/place-photo` resolves the reference at render time.
  image jsonb,

  origin text not null default 'manual',
  sources jsonb not null default '[]'::jsonb,

  like_count integer not null default 0,
  quality_score numeric,

  status text not null default 'draft',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,

  constraint recommendations_country_slug_key unique (country_code, slug),
  constraint recommendations_status_check
    check (status in ('draft', 'in_review', 'published', 'rejected', 'retired')),
  constraint recommendations_origin_check
    check (origin in ('import', 'manual', 'ai', 'user_submission')),
  constraint recommendations_cost_band_check
    check (cost_band is null or cost_band in ('free', '$', '$$', '$$$', '$$$$')),
  constraint recommendations_geocode_precision_check
    check (geocode_precision in ('rooftop', 'exact', 'approximate', 'city', 'country', 'unknown')),
  constraint recommendations_lat_range check (lat is null or (lat >= -90 and lat <= 90)),
  constraint recommendations_lng_range check (lng is null or (lng >= -180 and lng <= 180))
);

-- The deck's only query: everything published for the countries a trip visits.
create index if not exists recommendations_country_status_idx
  on public.recommendations (country_code, status);
-- The admin list orders by most recently touched.
create index if not exists recommendations_updated_at_idx
  on public.recommendations (updated_at desc);
-- Tag search, which the admin filter and a future public search both need.
create index if not exists recommendations_tags_idx
  on public.recommendations using gin (tags jsonb_path_ops);

create or replace function public.touch_recommendations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists recommendations_set_updated_at on public.recommendations;
create trigger recommendations_set_updated_at
  before update on public.recommendations
  for each row execute function public.touch_recommendations_updated_at();

alter table public.recommendations enable row level security;

-- Published rows are public: the deck has to work for a signed-out traveller
-- opening a shared link. Everything else is invisible without the service role,
-- which is what the admin edge function uses.
drop policy if exists "Recommendations published read" on public.recommendations;
create policy "Recommendations published read" on public.recommendations
for select to anon, authenticated using (status = 'published');

comment on table public.recommendations is
  'Shared library of place recommendations shown in the trip Ideas deck. Seeded from data/recommendations/<cc>.json; maintained in the admin.';

-- The deck reads directly through PostgREST, so the read roles need the grant
-- as well as the policy; RLS narrows a grant, it does not create one.
grant select on public.recommendations to anon, authenticated;
grant all on public.recommendations to service_role;
