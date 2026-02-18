# Admin Trip Access (Phase 1)

## Scope shipped

- Admin users can open any trip route (`/trip/:tripId`) even when they are not the trip owner.
- Access is enforced in Supabase via admin permission checks (`trips.read`) in `public.admin_get_trip_for_view(...)`.
- Non-admin users keep existing owner-based behavior.
- Admin fallback trips now open read-only by default, with an explicit admin override switch to enable editing.
- Trip view now shows direct owner identity context and a one-click jump into the owner drawer in Admin Users.
- Admin override writes now use a dedicated audited RPC path (`public.admin_override_trip_commit(...)`) guarded by `trips.write`.

## Lifecycle guardrails

- Archived trips stay read-only in trip view, even in admin fallback.
- Expired trips stay read-only in trip view, even in admin fallback.
- Editing non-owned trips requires explicit enablement each time the trip page is opened.

## Main implementation files

- `docs/supabase.sql`
  - Added `public.admin_get_trip_for_view(p_trip_id text)`
  - Added `public.admin_override_trip_commit(...)`
- `services/dbService.ts`
  - `dbGetTrip(...)` now attempts admin fallback only when owner-scoped fetch returns no row and returns access metadata.
  - Added `dbAdminOverrideTripCommit(...)` wrapper.
- `App.tsx`
  - Trip loader now passes admin access context into trip view and routes admin override commits through the new RPC.
- `components/TripView.tsx`
  - Added admin fallback banner, explicit override switch, and owner deep-link CTA.
- `pages/AdminUsersPage.tsx`
  - Added URL-driven drawer deep links (`/admin/users?user=<uuid>&drawer=user`).
