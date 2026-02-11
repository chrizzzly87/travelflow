# Auth + Roles Implementation Notes (Critical Follow-up)

Status: Required follow-up before login/register launch  
Last updated: 2026-02-11

## Why this exists

The AI benchmark implementation will use a temporary static admin header for internal endpoints.
This is acceptable short-term but must be replaced during auth/role rollout.

## Temporary mechanism (v1 only)

1. Internal endpoints under `/api/internal/ai/*` accept `x-tf-admin-key`.
2. Header value is compared against server-side env var `TF_ADMIN_API_KEY`.
3. This should never be treated as final authorization design.

## Required migration during login/register implementation

## 1) Data model

1. Extend `public.profiles` with role fields:
   1. `role text not null default 'user'` (expected values: `user`, `tester`, `admin`)
   2. optional audit fields (`role_updated_at`, `role_updated_by`)
2. Add indexes needed for role checks.

## 2) Authn/Authz flow

1. Keep Supabase auth for identity.
2. Resolve role from `profiles` table (or JWT custom claims after setup).
3. Protect admin routes (`/admin/*`) via role guard in app routing.
4. Protect internal benchmark endpoints by authenticated admin role check.

## 3) Endpoint migration

1. Replace static header guard with authenticated session + role check.
2. Keep static header as emergency fallback only if explicitly enabled by env flag.
3. Log rejection reasons without leaking secrets.

## 4) UI gating migration

1. Main create-trip provider selector is currently visible only in simulated-login mode.
2. Replace simulated-login gating with role-based gating:
   1. `tester` and `admin` can view/modify provider selector.
   2. `user` cannot.
3. Benchmark page should be admin-only by default.

## 5) Cleanup and hardening

1. Rotate and then remove static admin key from env when role guard is live.
2. Add audit log entries for benchmark session creation, reruns, exports, and cleanup actions.
3. Add rate-limit buckets by authenticated user id.

## 6) Done criteria for this migration

1. No internal endpoint relies on static header for primary authorization.
2. Admin/tester-only UI is controlled by role checks, not debug toggles.
3. Security review checklist passes for admin routes and benchmark APIs.
