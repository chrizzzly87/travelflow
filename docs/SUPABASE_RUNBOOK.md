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
- Foundation tables for future auth monetization (`profiles`, `plans`, `subscriptions`).

## Setup (Detailed)

### 1. Supabase project

1. Create a Supabase project.
2. Open `Authentication -> Providers -> Anonymous`.
3. Enable anonymous sign-ins.
4. For local testing, disable captcha if it blocks anonymous signup.

Why this matters:
- The app expects an anonymous session for every DB operation.
- If anonymous auth is disabled, writes and share RPCs fail immediately.

### 2. Run schema + RPC SQL

1. Open Supabase SQL Editor.
2. Run `/Users/chrizzzly/.codex/worktrees/7b0e/travelflow-codex/docs/supabase.sql`.

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
  'update_shared_trip'
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
- `DB_ENABLED` comes from `isSupabaseEnabled` in `/Users/chrizzzly/.codex/worktrees/7b0e/travelflow-codex/services/supabaseClient.ts`.

### 5. Start app

```bash
npm run dev
```

Then hard refresh once after env changes.

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

## Runtime Write Path

Main write path (client):

1. Ensure anonymous session.
2. Upsert latest trip via `rpc('upsert_trip', ...)`.
3. Append snapshot via `rpc('add_trip_version', ...)`.

Share path:

1. `rpc('create_share_token', ...)`.
2. Open share URL `/s/:token`.
3. Load shared data via `rpc('get_shared_trip', ...)`.
4. Optional snapshot load via `rpc('get_shared_trip_version', ...)` when URL has `?v=<uuid>`.
5. If share mode is `edit`, save changes via `rpc('update_shared_trip', ...)`.
6. In `view` mode, editing controls are disabled; copy creates a new owned trip.

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

History debug helper (already wired in app):

```js
window.tfSetHistoryDebug(true);
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

- `/Users/chrizzzly/.codex/worktrees/7b0e/travelflow-codex/docs/supabase.sql`
