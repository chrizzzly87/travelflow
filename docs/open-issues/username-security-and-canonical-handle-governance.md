# Username Security and Canonical Handle Governance (Follow-up)

## Status
Open issue (follow-up). Not yet implemented.
GitHub issue: https://github.com/chrizzzly87/travelflow/issues/208

## Objective
Harden username handling end-to-end so handles are:
1. Safe against impersonation and abusive content.
2. Consistent across frontend, backend, database, and routing.
3. Case-insensitive for uniqueness, while preserving user-selected display casing.

## Current State (Baseline)
1. Frontend and backend currently normalize usernames to lowercase.
2. Existing validation pattern is effectively lowercase-only and currently allows 3-30 chars.
3. Existing reserved list is small and static.
4. Public profile routes resolve canonical lowercase handle values and support redirect lookups for previous handles.
5. No dedicated DB-managed denylist governance model exists yet.

## Target Contract (Decision Locked)
1. Allowed characters: `A-Z`, `a-z`, `0-9`, `_`, `-`.
2. Length: min `3`, max `20`.
3. No spaces or other symbols.
4. Case-insensitive uniqueness everywhere (`ADMIN`, `admin`, `AdMiN` are the same canonical handle).
5. Preserve user-entered casing for display.
6. Canonical URL is always lowercase.

## Data Model and Interface Changes
1. Add `profiles.username_display` (text): exact user-entered casing.
2. Keep canonical uniqueness on lowercase key:
- Preferred: `profiles.username_canonical` (text, lowercase-only, unique).
- Compatibility option: keep canonical in existing `profiles.username` if migration chooses not to split canonical column.
3. Add DB-managed governance tables:
- `public.username_blocked_terms` (denylist terms).
- `public.username_reserved_handles` (owner/admin reservable handles).
4. Extend RPC outputs where relevant:
- `profile_check_username_availability` evaluates canonical form against denylist/reserved tables and uniqueness.
- `profile_resolve_public_handle` returns canonical + display username fields.
- `admin_update_user_profile` (or successor admin RPC) supports protected reserved-handle assignment for authorized admins.

## Backend Enforcement Scope
1. Keep DB trigger and RPC path as source of truth (never frontend-only trust).
2. Enforce charset, min/max length, denylist, reserved handles, and case-insensitive uniqueness in DB layer.
3. Continue cooldown and redirect handling for username changes.
4. Normalize comparisons to lowercase canonical value before collision checks.

## Frontend Scope
1. Immediate username feedback while typing.
2. Disallow or sanitize unsupported characters in input.
3. Show validation state without waiting for submit.
4. Send display-cased input; backend derives/verifies canonical value.
5. Show `@{username_display}` in profile UI.
6. Keep all generated links on lowercase canonical URL.

## Routing Scope
1. Keep public routes unchanged:
- `/u/:username`
- `/u/:username/stamps`
2. Canonical redirect behavior:
- `/u/EXAMPLE` -> `/u/example` (replace navigation)
- `/u/EXAMPLE/stamps` -> `/u/example/stamps`
3. Preserve renamed-handle redirect compatibility.

## Denylist Governance
1. Primary enforcement is backend/DB on submit and availability checks.
2. Denylist source file: `docs/security/username-denylist.md`.
3. Seed strategy:
- Baseline profanity/hate set from pinned package release.
- Custom security and impersonation set for product risk.
4. Reserved-handle model:
- Separate reserved namespace for owner/admin-controlled handles.
- Not claimable by regular users.

## Migration and Rollout Plan
1. Add schema columns/tables and indexes (non-breaking first).
2. Backfill canonical/display values for existing profiles.
3. Switch read path to canonical + display fields.
4. Switch write path and RPC contract.
5. Run compatibility phase for legacy rows and redirect table behavior.
6. Remove temporary compatibility logic after stabilization.

## Acceptance Criteria
1. DB trigger/RPC rejects invalid charset, too-short (<3), too-long (>20), blocked, and reserved terms.
2. Case-insensitive uniqueness enforced across create/update.
3. Mixed-case username persists display casing while canonical is lowercase.
4. Public profile routes redirect uppercase/mixed-case URLs to lowercase canonical URLs.
5. Profile UI renders `@username_display`; profile links always target lowercase canonical URL.
6. Frontend gives immediate feedback and blocks/sanitizes unsupported characters.
7. Reserved owner/admin handles are blocked for standard users and assignable only via authorized admin path.
8. Existing cooldown and legacy redirect behavior remain covered by regression tests.

## Test Plan Requirements
1. SQL/RPC tests:
- Canonical collision checks.
- Reserved/denylist checks.
- Min/max/charset checks.
2. Unit/browser tests:
- Profile settings input behavior.
- Availability status states.
- Canonical URL generation from mixed-case display username.
3. Routing tests:
- `/u/:username` and `/u/:username/stamps` uppercase redirect behavior.
4. Regression tests:
- Username cooldown path.
- Handle redirect lookup path.

## Risks and Mitigations
1. Risk: false positives in denylist.
- Mitigation: governance metadata (`source`, `reason`, `severity`, `active`), owner override workflow.
2. Risk: migration drift between display and canonical values.
- Mitigation: idempotent backfill + consistency checks + temporary dual-read assertions.
3. Risk: SEO/link churn from canonical redirects.
- Mitigation: keep stable lowercase canonical URL and preserve old-handle redirect contract.

## GitHub Issue Draft
### Title
Username security hardening with canonical lowercase routing and display-casing preservation

### Body
Implement end-to-end username hardening across frontend, backend, database, and profile routing.

Scope:
- Enforce username contract: `A-Z`, `a-z`, `0-9`, `_`, `-`, length `3-20`.
- Introduce display/canonical model:
  - `username_display` keeps user casing.
  - lowercase canonical handle is used for uniqueness, lookup, and URLs.
- Keep DB trigger/RPC as source of truth for validation and uniqueness.
- Add DB-managed denylist + reserved handle tables.
- Seed denylist from pinned baseline package + custom security terms.
- Add owner/admin-reservable handles (not claimable by standard users).
- Keep public profile routes `/u/:username` and `/u/:username/stamps`.
- Canonicalize URL casing via redirect (`/u/EXAMPLE` -> `/u/example`).
- Render profile identity with display casing while link targets remain canonical lowercase.

Acceptance criteria:
- Invalid charset/length and blocked/reserved handles are rejected server-side.
- Case-insensitive collision is enforced (`ADMIN` == `admin`).
- Display casing persists while canonical URL is lowercase.
- Upper/mixed-case public profile URLs auto-redirect to lowercase canonical URLs.
- Frontend provides immediate input feedback and disallows/sanitizes unsupported chars.
- Reserved handles are assignable only via authorized admin flow.
- Regression coverage remains green for cooldown and legacy handle redirects.

Implementation notes:
- Backend source of truth is `docs/supabase.sql`.
- Denylist source file (complete terms + metadata): `docs/security/username-denylist.md`.
