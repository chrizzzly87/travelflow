# Admin Trip Access (Phase 1)

## Scope shipped

- Admin users can open any trip route (`/trip/:tripId`) even when they are not the trip owner.
- Access is enforced in Supabase via admin permission checks (`trips.read`) in `public.admin_get_trip_for_view(...)`.
- Non-admin users keep existing owner-based behavior.
- Admin fallback trips open read-only by default, with an explicit admin override switch to enable editing.
- The trip page shows the owner's identity and a one-click jump to that owner's details in the admin Users sheet.
- Admin override writes use a dedicated audited RPC path (`public.admin_override_trip_commit(...)`) guarded by `trips.write`.

## Lifecycle guardrails

- Archived trips stay read-only in trip view, even in admin fallback.
- Expired trips stay read-only in trip view, even in admin fallback.
- Editing non-owned trips requires explicit enablement each time the trip page is opened.

## Admin deep links

| Link | Opens |
|---|---|
| `/admin/trips?trip=<tripId>&drawer=trip` | The Trips screen with that trip's details sheet open (fetched on demand if it is outside the loaded list). |
| `/admin/users?user=<uuid>&drawer=user` | The Users screen with that user's details sheet open. |
| `/admin/trips?user=<uuid>&drawer=user` | Legacy owner-drawer link, still used by the trip page banner. The Trips screen no longer has its own owner drawer; it forwards (history replace) to the Users link above. |

Within the Trips screen, the owner column and the "Open in Users" link in a trip's details
both go straight to the Users sheet, so owner details are maintained in one place.

## Main implementation files

- `docs/supabase.sql`
  - `public.admin_get_trip_for_view(p_trip_id text)`
  - `public.admin_override_trip_commit(...)`
- `services/dbService.ts`
  - `dbGetTrip(...)` attempts the admin fallback only when the owner-scoped fetch returns no row, and returns access metadata.
  - `dbAdminOverrideTripCommit(...)` wrapper.
- `routes/TripLoaderRoute.tsx`
  - Passes the admin fallback access context into the trip view.
- `components/TripView.tsx`, `components/tripview/TripViewStatusBanners.tsx`
  - Admin fallback banner, explicit override switch, and the owner link (`ownerUsersUrl`).
- `pages/AdminUsersPage.tsx`
  - URL-driven user details sheet (`/admin/users?user=<uuid>&drawer=user`).
- `pages/AdminTripsPage.tsx`, `components/admin/adminTripsModel.ts`
  - Trip details sheet deep link, and the forward from the legacy owner link (`getLegacyOwnerDeepLinkTarget`).
