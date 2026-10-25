# Admin Workspace Follow-ups

Last updated: 2026-10-24

Open admin items that are deliberately deferred, grouped by what they need. What each screen
does today is in [`ADMIN_SCREENS.md`](./ADMIN_SCREENS.md).

## Done (for reference)

- [x] Shell layout: viewport-pinned sidebar with its own scroll area, page-scroll content, one
  shared page header (2026-10-24, admin redesign). This replaced the February notes about the
  sidebar breaking on long tables.
- [x] Full shell and spacing pass across every screen; shared filter, selection, pagination and
  detail-sheet components (`DESIGN_SYSTEM_COMPONENTS.md` → Admin workspace).
- [x] Filter menu keyboard access and visual parity (`AdminFilterMenu`).
- [x] User deletion operations, transfer-before-delete, deep links from Trips/Audit/trip view
  into the Users sheet (`ADMIN_USER_DELETION_POLICY.md`).

## Needs backend or schema work

- [ ] **Server-side paging and filtering** for Users (500-row cap), Trips (600), Audit (500 per
  source) and Worker health (latest 50). KPI tiles on those screens count only the loaded rows.
- [ ] **Plans read RPC.** The Plans screen starts each form from `PLAN_CATALOG` defaults because
  no RPC returns the stored `plans.entitlements`; saving can silently revert an earlier stored
  edit. Add an `admin_get_plan_entitlements`-style read.
- [ ] **Billing:** a range-aware server count for sync issues (failed + unlinked webhooks), and a
  "replay one webhook event" RPC (repair currently goes through a subscription reconcile).
- [ ] **AI telemetry:** a server-side summary so totals stay exact past the 2,000-row cap, and
  window-wide failure-code counts (today: latest 120 rows).
- [ ] **Users:** a "resend invite" endpoint for the Awaiting activation queue.
- [ ] **Trips:** a batch RPC for bulk archive/delete (today one request per trip).
- [ ] **Legal terms:** persisted drafts (the service has no draft state; a reload loses one).
- [ ] **Recommendations:** bulk publish/retire and a review queue.
- [ ] **RBAC strict mode:** backfill `public.admin_user_roles`, remove the fail-open path and the
  edge permission fallback in `netlify/edge-functions/admin-iam.ts`
  (`AUTH_ROLES_IMPLEMENTATION_NOTES.md`).

## Needs a product decision

- [ ] Audit log `?entry=<source:id>` deep link for sharing one event.
- [ ] AI benchmark session switcher (the API already returns past sessions) and a `?run=` deep link.
- [ ] Whether the AI benchmark's 7-day leaders should live only on AI telemetry.
- [ ] Whether the Airports ticket lab belongs in the design system playground.
- [ ] Users sheet `?tab=` param, so the Audit log can link straight to a user's Activity.

## Code hygiene

- [x] One relative-time format: every screen's helper delegates to
  `components/admin/adminRelativeTime.ts` (2026-10-25).
- [x] One chart foundation: AI telemetry uses the shared `components/admin/charts` area and
  bar charts (decimal values included); the local `TelemetrySeriesChart` is gone.
- [ ] `AdminStatCard` as a pressable tile (work-queue tiles currently toggle through a link
  button in the hint).
- [ ] `components/admin/AdminAirportTesterMap.tsx` type errors: wire `@types/google.maps`.

## Quick resume checklist

1. Read `ADMIN_SCREENS.md` for the screen you are changing.
2. `TZ=Europe/Berlin npx vitest run tests/browser/admin tests/unit/admin*`
3. Check the screen in the browser at 1440px and 375px, light and dark (local dev: set
   `VITE_DEV_ADMIN_BYPASS=true`; turn on mock data with `tf_debug_simulated_login=1`).
