-- Generated from config/planCatalog.ts
-- Do not edit manually.

insert into public.plans (
  key,
  name,
  price_cents,
  max_trips,
  entitlements,
  sort_order,
  is_active
)
values
(
  'tier_free',
  'Backpacker',
  0,
  5,
  '{"maxActiveTrips":5,"maxTotalTrips":50,"tripExpirationDays":14,"canShare":true,"canCreateEditableShares":false,"canViewProTrips":true,"canCreateProTrips":false}'::jsonb,
  10,
  true
),
(
  'tier_mid',
  'Explorer',
  900,
  30,
  '{"maxActiveTrips":30,"maxTotalTrips":500,"tripExpirationDays":90,"canShare":true,"canCreateEditableShares":true,"canViewProTrips":true,"canCreateProTrips":true}'::jsonb,
  20,
  true
),
(
  'tier_premium',
  'Globetrotter',
  1900,
  2147483647,
  '{"maxActiveTrips":null,"maxTotalTrips":null,"tripExpirationDays":null,"canShare":true,"canCreateEditableShares":true,"canViewProTrips":true,"canCreateProTrips":true}'::jsonb,
  30,
  true
)
on conflict (key) do update
set
  name = excluded.name,
  price_cents = excluded.price_cents,
  max_trips = excluded.max_trips,
  entitlements = excluded.entitlements,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;
