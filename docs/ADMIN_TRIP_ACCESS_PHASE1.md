# Admin Trip Access (Phase 1)

## Scope shipped

- Admin users can open any trip route (`/trip/:tripId`) even when they are not the trip owner.
- Access is enforced in Supabase via admin permission checks (`trips.read`) in `public.admin_get_trip_for_view(...)`.
- Non-admin users keep existing owner-based behavior.

## Intentionally deferred

- "Admin override mode" for editing non-owned trips.
- Read-only banner/indicator inside trip view when opened via admin fallback.
- Direct owner identity block/link in trip view itself (outside admin tables/drawers).

## Main implementation files

- `docs/supabase.sql`
  - Added `public.admin_get_trip_for_view(p_trip_id text)`
- `services/dbService.ts`
  - `dbGetTrip(...)` now attempts admin fallback only when owner-scoped fetch returns no row.
