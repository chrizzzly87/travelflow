# Admin Workspace Follow-ups

Last updated: 2026-02-18

This note captures open admin/user-management items that are intentionally deferred, plus where to resume implementation quickly.

## Confirmed Open UI Items (Deferred)

- [ ] Left sidebar does not behave correctly with long table pages and does not use full usable window height in all cases.
  - Symptom: on long data-table pages, shell feels visually broken and left rail/viewport behavior is inconsistent.
  - Primary file: `components/admin/AdminShell.tsx`
  - Current layout areas to revisit:
    - Desktop rail wrapper with `h-screen` and local scroll region.
    - `main` content flow and how page-level vertical overflow is handled.
    - Header stickiness and interaction with long table sections.
  - Decision pending: keep viewport-pinned shell (independent scroll regions) vs page-scroll shell (single document flow).

- [ ] Full admin-shell layout pass to simplify and stabilize spacing/height behavior across all admin pages.
  - Primary file: `components/admin/AdminShell.tsx`
  - Affected pages: `pages/AdminDashboardPage.tsx`, `pages/AdminUsersPage.tsx`, `pages/AdminTripsPage.tsx`, `pages/AdminTiersPage.tsx`, `pages/AdminAuditPage.tsx`

## Open UX/Feature Follow-ups

- [ ] Final polish pass for data-table filter UX parity once the shell layout refactor is done.
  - Current filter components are functional; final visual rhythm and spacing should be revisited after shell refactor.
  - Primary shared component: `components/admin/AdminFilterMenu.tsx`

## Data/Backend Follow-ups (Still Relevant)

- [ ] RBAC strict-mode rollout:
  - Backfill explicit admin role assignments in `public.admin_user_roles`.
  - Remove fail-open compatibility behavior in permission checks.
  - Existing note: `docs/AUTH_ROLES_IMPLEMENTATION_NOTES.md`

- [ ] Remove edge-function permission fallback once RPC path is fully guaranteed.
  - File: `netlify/edge-functions/admin-iam.ts`

- [ ] Server-side pagination/filtering for large datasets (Users/Trips/Audit).
  - Current pages still fetch capped batches and filter client-side.
  - Files:
    - `pages/AdminUsersPage.tsx`
    - `pages/AdminTripsPage.tsx`
    - `pages/AdminAuditPage.tsx`
    - `services/adminService.ts`
    - `docs/supabase.sql` (RPC extensions)

## What Was Just Finished (Reference)

- Trips table:
  - Direct trip link from first column.
  - Owner cell opens owner-info drawer.
  - File: `pages/AdminTripsPage.tsx`

- User details drawer:
  - Connected trip titles now open trip URLs directly.
  - Trip title area widened to avoid early ellipsis.
  - File: `pages/AdminUsersPage.tsx`

- Trip-owner deep links:
  - Trips and trip-view admin fallback now deep-link directly into the Users drawer via URL state.
  - File: `pages/AdminTripsPage.tsx`
  - File: `components/TripView.tsx`
  - File: `pages/AdminUsersPage.tsx`

## Quick Resume Checklist (Next Admin Iteration)

1. Reproduce sidebar height/long-table break on Users and Trips with long datasets.
2. Refactor `AdminShell` height/overflow strategy first (before cosmetic polish).
3. Re-check filter/menu alignment after shell refactor.
4. Run:
   - `npm run build`
   - targeted UI verification on:
     - `/admin/users`
     - `/admin/trips`
     - `/admin/tiers`
     - `/admin/audit`
