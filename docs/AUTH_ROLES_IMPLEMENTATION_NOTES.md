# Auth + Roles Implementation Notes

Status: Implemented (V1)  
Last updated: 2026-02-13

## V1 model

1. Identity: Supabase Auth (anonymous + email/password + OAuth).
2. Roles: `admin` and `user` in `public.profiles.system_role`.
3. Tiers: `tier_free`, `tier_mid`, `tier_premium` in `public.profiles.tier_key`.
4. Effective entitlements: plan defaults (`public.plans.entitlements`) merged with `profiles.entitlements_override`.

## Admin routing and UI

1. `/admin/dashboard`, `/admin/ai-benchmark`, and `/admin/access` are guarded in app routing.
2. Only users resolved as `system_role = 'admin'` can access `/admin/*`.
3. Admin pages share an internal menu for dashboard, benchmark, and access-control views.
4. `/admin/access` supports per-user tier assignment, per-user entitlement overrides, and plan-template entitlement updates (`admin_update_plan_entitlements`).

## Internal benchmark authorization

1. Primary authorization is now bearer-token role validation (`get_current_user_access` => `system_role = 'admin'`).
2. `x-tf-admin-key` is no longer required by the UI.
3. Emergency fallback via static admin key exists only when `TF_ENABLE_ADMIN_KEY_FALLBACK` is enabled.

## Simulated login policy

1. Simulated login no longer controls protected admin routes.
2. Simulated login can still be used for non-security debug UX paths.
3. Security decisions (route access, admin RPC, benchmark API) are role-driven only.

## Remaining hardening backlog

1. Add dedicated admin audit rows for benchmark actions (run, rerun, export, cleanup, cancel).
2. Add per-user benchmark rate limiting.
3. Move benchmark admin authorization to a dedicated shared edge auth module.
4. Backfill explicit records in `public.admin_user_roles` for every active admin account, then switch `public.has_admin_permission(...)` from compatibility mode to strict role-only checks (remove legacy fail-open path).
5. Add a migration checklist for strict-RBAC rollout (role backfill verification, staging smoke test, production cutover window, rollback SQL).
