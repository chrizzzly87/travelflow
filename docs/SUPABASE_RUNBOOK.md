# TravelFlow Supabase Runbook

This document captures the current database-backed trip system, setup steps, and the fastest fixes for the failures we already hit.

## Scope

Implemented in this project:

- Trip persistence by `trip.id` (no long encoded URL state for normal usage).
- Snapshot history in `trip_versions` with per-change labels.
- Share links with `view` and `edit` modes.
- View-only shared trips with UI-level edit lock.
- Copy/fork flow from shared trip into a new owner trip.
- User-scoped app settings persistence.
- LocalStorage import to DB on startup.
- Auth + access foundation (`profiles`, `plans`, `subscriptions`, `admin_allowlist`).
- Auth flow observability (`auth_flow_logs`) and queue handoff (`trip_generation_requests`).

## Setup (Detailed)

### 1. Supabase project

1. Create a Supabase project.
2. Open `Authentication -> Providers -> Anonymous`.
3. Enable anonymous sign-ins.
4. For local testing, disable captcha if it blocks anonymous signup.

Why this matters:
- Guest trip/share flows rely on anonymous sessions when no authenticated user exists.
- Authenticated profile/access/settings flows must not auto-create anonymous sessions.
- If anonymous auth is disabled, guest trip writes and share RPCs fail immediately.

### 2. Run schema + RPC SQL

1. Open Supabase SQL Editor.
2. Run `docs/supabase.sql`.

Notes:
- The file is idempotent for policies (`drop policy if exists ...` then create).
- It also creates required RPC functions and grants execute permissions.

### 3. Verify required DB primitives

Run these checks in SQL Editor:

```sql
select extname from pg_extension where extname = 'pgcrypto';
```

```sql
select proname
from pg_proc
where proname in (
  'upsert_trip',
  'add_trip_version',
  'create_share_token',
  'get_shared_trip',
  'get_shared_trip_version',
  'update_shared_trip',
  'get_current_user_access',
  'admin_list_users',
  'admin_update_user_tier',
  'admin_update_user_overrides',
  'admin_update_plan_entitlements',
  'create_trip_generation_request',
  'claim_trip_generation_request',
  'expire_stale_trip_generation_requests',
  'log_auth_flow'
)
order by proname;
```

```sql
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('trips', 'trip_versions', 'trip_shares', 'trip_collaborators', 'user_settings')
order by tablename, policyname;
```

### 4. App environment

Set these in `.env.local`:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Optional debug:

```env
VITE_DEBUG_DB=true
```

Important:
- `DB_ENABLED` is true only when both vars are present.
- `DB_ENABLED` comes from `isSupabaseEnabled` in `services/supabaseClient.ts`.

### 5. Start app

```bash
npm run dev
```

Then hard refresh once after env changes.

### 6. Auth redirect allowlist (required for password recovery)

In Supabase Dashboard, configure:

1. `Authentication -> URL Configuration -> Site URL`:
   - `https://travelflowapp.netlify.app`
2. `Authentication -> URL Configuration -> Redirect URLs`:
   - `https://travelflowapp.netlify.app/login`
   - `https://travelflowapp.netlify.app/auth/reset-password`
   - `http://localhost:5173/login`
   - `http://localhost:5173/auth/reset-password`

Why this matters:
- Forgot-password / set-password emails redirect users to `/auth/reset-password`.
- If this path is missing in Redirect URLs, recovery links fail or land on an auth error page.

## Data Model (Current)

Core tables:

- `trips`: canonical trip state, owner, current view settings, fork metadata.
- `trip_versions`: immutable snapshots with labels, version numbers.
- `trip_shares`: share token, mode (`view` or `edit`), copy permission.
- `trip_collaborators`: future owner-managed collaborator roles.
- `user_settings`: user-scoped app preferences.

Future monetization/auth tables already present:

- `profiles`
- `plans`
- `subscriptions`
- `admin_allowlist`
- `auth_flow_logs`
- `trip_generation_requests`

## Auth + Roles V1

1. Roles are stored in `public.profiles.system_role` (`admin` | `user`).
2. Tier keys are stored in `public.profiles.tier_key` (`tier_free` | `tier_mid` | `tier_premium`).
3. Effective entitlements are resolved by `get_effective_entitlements(uuid)`:
   - plan defaults from `public.plans.entitlements`
   - merged with per-user overrides in `profiles.entitlements_override`
4. Access context RPC: `get_current_user_access()`.

## Guest Queue Handoff

1. Anonymous submit path writes to `trip_generation_requests` via `create_trip_generation_request(...)`.
2. Post-login processing claims rows via `claim_trip_generation_request(...)`.
3. Stale rows are expired via `expire_stale_trip_generation_requests()`.
4. Default queue TTL is 14 days.

## Onboarding Gate Contract

1. Required onboarding applies only to authenticated, non-anonymous users with incomplete onboarding.
2. Anonymous and identity-uncertain sessions are treated as guest sessions and must never be forced into onboarding.
3. Public planner-entry routes are exempt from forced onboarding redirects:
   - `/create-trip`
   - `/trip/*`
   - `/s/*`
   - `/example/*`
4. Guest trip generation handoff contract:
   - Guest starts generation and sees the generation/loading shell.
   - Request is queued (`trip_generation_requests`) before generation execution.
   - User is prompted to sign in/register.
   - Login uses `claim=<requestId>` and resumes queued generation after auth.
   - Successful claim navigates to the generated trip (`/trip/:id`).

## Runtime Write Path

Main write path (client):

1. Ensure DB session (authenticated owner if available, anonymous only for guest trip flows).
2. Upsert latest trip via `rpc('upsert_trip', ...)`.
3. Append snapshot via `rpc('add_trip_version', ...)`.

Share path:

1. `rpc('create_share_token', ...)`.
2. Open share URL `/s/:token` (canonical shared route).
3. If a direct planner URL (`/trip/:tripId`) is opened by a non-owner (and non-admin) for a trip that has an active share, the trip loader resolves the active share token and routes to `/s/:token`.
4. Load shared data via `rpc('get_shared_trip', ...)`.
5. Optional snapshot load via `rpc('get_shared_trip_version', ...)` when URL has `?v=<uuid>`.
6. If share mode is `edit`, save changes via `rpc('update_shared_trip', ...)`.
7. In `view` mode, editing controls are disabled; copy creates a new owned trip.

## Migration Behavior (LocalStorage -> DB)

On app init with DB enabled:

1. Existing local trips are uploaded.
2. DB trips are fetched and synced back to local storage cache.

This allows old local trips to be converted without manual recreation.

## Troubleshooting Matrix (Learned From Real Failures)

### `AuthApiError: Anonymous sign-ins are disabled`

Cause:
- Anonymous provider disabled in Supabase.

Fix:
- Enable anonymous auth in Supabase auth providers.

### `429 Too Many Requests` from `/auth/v1/signup`

Cause:
- Repeated anonymous sign-in attempts (often after session instability or rapid refresh loops).

Fix:
- Stop rapid refresh/reload loops.
- Clear local auth token in browser storage (`sb-<project-ref>-auth-token`) and reload once.
- Wait for rate limit window to cool down.

### Interaction triggers repeated auth/profile RPC bursts on public pages

Symptom:
- Clicking anywhere on a public profile or other marketing page triggers many requests:
  - `/auth/v1/user`
  - `rpc/get_current_user_access`
  - `profiles?...`
  - repeated public-handle resolver calls
- In severe cases this appears as flashing/re-render loops and can create many anonymous users.

Root cause (incident 2026-02-27):
- Public/guest pages were indirectly calling user-settings sync code that used `ensureDbSession()`.
- `ensureDbSession()` creates anonymous auth sessions when no session exists.
- The new anonymous session then triggered `getCurrentAccessContext()` + profile refresh chains.
- Interaction-gated auth bootstrap made this especially visible on first click.

Current mitigation:
1. `dbGetUserSettings` and `dbUpsertUserSettings` now require an existing non-anonymous session.
2. Auth access resolution short-circuits anonymous sessions (no `get_current_user_access` RPC for anon).
3. Auth context does not load profile data for anonymous sessions.
4. App-level settings persistence runs only for authenticated non-anonymous users.

Verification:
1. Open `/u/<missing-handle>` in a clean browser profile.
2. Click body/background.
3. Confirm no new Supabase auth/access/profile request burst occurs.

### `403 session_not_found` after `logout -> immediate OAuth login`

Symptom:
- First social login succeeds.
- Logout appears to succeed.
- Immediate social login attempt fails to establish session.
- URL hash briefly shows OAuth tokens (`#access_token=...`) and then disappears.
- Network shows `403` from `/auth/v1/user` with:
  - `{"code":"session_not_found","message":"Session from session_id claim in JWT does not exist"}`
- Hard refresh makes login work again.

Root causes seen in this app:
- Stale Supabase auth storage can keep a JWT whose `session_id` no longer exists server-side.
- OAuth callback hash tokens can be dropped when an anonymous session is still active.
- Anonymous `linkIdentity` OAuth upgrades are fragile under stale-session conditions.
- SPA in-memory auth state can remain inconsistent until full reload.

Current mitigation in app code:
1. Logout path clears stale Supabase auth keys from browser storage (`sb-*auth-token*`, refresh/code-verifier keys), even when Supabase returns `403 session_not_found`.
2. OAuth path uses standard `signInWithOAuth` (no anonymous `linkIdentity` path).
3. Auth bootstrap applies callback hash tokens even when current session is anonymous.
4. Logout UI actions perform hard navigation/reload to reset in-memory auth state immediately.

Verification sequence:
1. Login with Google/Facebook/Kakao.
2. Logout.
3. Login again immediately (no manual refresh).
4. Confirm user session is restored and authenticated routes work.

### `42501 new row violates row-level security policy for table "trips"` or `"trip_versions"`

Cause:
- Session user and row ownership checks do not align.
- Missing/old policy or RPC path not used.

Fix:
- Re-run full `docs/supabase.sql`.
- Confirm app is calling `upsert_trip` and `add_trip_version` RPCs.
- Verify anonymous session exists before write.

### `42P17 infinite recursion detected in policy for relation "trips"`

Cause:
- A policy references the same table in a way that recursively triggers itself.

Fix:
- Use the helper function approach in current SQL (`is_trip_owner` security definer).
- Re-run current `docs/supabase.sql` to replace policies.

### `42883 function gen_random_bytes(integer) does not exist`

Cause:
- `pgcrypto` extension missing in active DB.

Fix:
- Ensure extension exists:
  - `create extension if not exists "pgcrypto";`
- Confirm `create_share_token` runs with `search_path = public, extensions` (already in SQL file).

### `404 /rest/v1/rpc/create_share_token` or function not found

Cause:
- RPC not created in DB, wrong schema, or old SQL state.

Fix:
- Re-run `docs/supabase.sql`.
- Verify function exists with `select proname from pg_proc ...`.

### `42710 policy ... already exists`

Cause:
- Non-idempotent policy creation from older SQL scripts.

Fix:
- Use only the current `docs/supabase.sql` (contains `drop policy if exists`).
- Remove reliance on older ad-hoc SQL snippets.

### `42702 column reference "id" is ambiguous` in RPCs

Cause:
- PL/pgSQL query or return clause uses `id` without table qualification in function scope.

Fix:
- Use fully qualified references in SQL functions.
- Re-run latest `docs/supabase.sql` where this is already corrected.

### `22P02 invalid input syntax for type uuid: "v-..."`

Cause:
- Non-UUID local version identifiers used against DB UUID columns.

Fix:
- Validate version IDs before DB query.
- Only query `trip_versions` when `v` param is a UUID.

### `PGRST116 Cannot coerce result to a single JSON object`

Cause:
- `.single()` used when row may not exist.

Fix:
- Use `.maybeSingle()` for optional row loads.

### Public profile shows `Profile not found` for valid handles

Cause:
- Client-side resolver fallback query is malformed (for example filter chaining before `.select(...)`).
- Username lookup uses pattern matching where exact matching is required.
- Resolver performs unnecessary enrichment calls that fail in partially migrated schemas.

Fix:
- Keep the public-handle resolution order:
  1. `profile_resolve_public_handle` RPC
  2. direct `profiles.username` exact lookup fallback
  3. `profile_handle_redirects` fallback
- For username fallback queries, always use exact `eq('username', value)` (not wildcard matching).
- Chain Supabase reads in the standard order: `.from(...).select(...).eq(...).maybeSingle()`.
- Do not issue admin-only identity RPC checks for anonymous viewers.

Verification:
- `POST /rest/v1/rpc/profile_resolve_public_handle` returns `found` for a known handle.
- `GET /u/{username}` renders profile content (not `Profile not found`).
- Browser network tab has no repeated `400` profile resolver fallback calls for a successful public profile load.

### Share modal says `Could not create share link` after SQL run

Cause:
- Usually one of:
  - missing anonymous session
  - missing grant on `create_share_token`
  - extension/function mismatch

Fix:
- Verify anonymous auth/session first.
- Verify grants exist in current SQL file.
- Verify `pgcrypto` and RPC functions exist.

## Debugging Aids

Enable DB debug logs in browser:

```js
localStorage.setItem('tf_debug_db', '1');
location.reload();
```

Disable:

```js
localStorage.removeItem('tf_debug_db');
location.reload();
```

Enable auth callback/session debug logs in browser:

```js
localStorage.setItem('tf_debug_auth', '1');
location.reload();
```

Disable:

```js
localStorage.removeItem('tf_debug_auth');
location.reload();
```

Note:
- Console output may be hard to inspect in OAuth redirect flows because navigation/reload can clear visible logs.
- Prefer the persisted auth trace (`tf_auth_trace_v1`) for post-redirect analysis.

History debug helper (already wired in app):

```js
window.tfSetHistoryDebug(true);
```

## Auth Trace Triage Workflow

1. Capture client trace from localStorage key `tf_auth_trace_v1`.
2. Match `flowId` and `attemptId` with server table `public.auth_flow_logs`.
3. Query example:

```sql
select flow_id, attempt_id, step, result, provider, error_code, created_at
from public.auth_flow_logs
where flow_id = '<flow-id>'
order by created_at asc;
```

4. Validate expected progression:
   - `start` -> `success` for happy-path
   - `start` -> `error` with deterministic `error_code` for failures
5. For OAuth callbacks, confirm:
   - client event `auth__callback--received`
   - server row for subsequent sign-in/upgrade step
6. If queue handoff is involved, inspect `trip_generation_requests` for the same user:

```sql
select id, status, owner_user_id, requested_by_anon_id, result_trip_id, error_message, created_at, updated_at, expires_at
from public.trip_generation_requests
where id = '<request-id>';
```

## Minimal Smoke Test

1. Create a new trip and edit one item.
2. Confirm trip save works with no 403/42501 errors.
3. Open share modal and generate a view-only link.
4. Open link in incognito:
   - Trip loads.
   - Editing controls are disabled.
   - Copy trip creates a new owned trip.
5. Confirm undo/redo and history panel still operate.

## File Reference

Authoritative SQL source:

- `docs/supabase.sql`
