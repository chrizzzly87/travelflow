# Incident Postmortem: Public Profile Refresh Chain from Anonymous Session Bootstrap (2026-02-27)

## Summary
On February 27, 2026, public profile routes (`/u/:username`) could trigger a repeated request chain after user interaction (especially first click), causing page blinking/flashing and bursts of Supabase calls.

The chain was driven by unintended anonymous session creation on guest/public surfaces, followed by auth/access/profile refresh sequences that were not needed for public rendering.

## Impact
- User-visible impact:
  - Public profile pages appeared to refresh/repaint after clicks.
  - Network tab showed repeated auth/profile resolver requests.
- Backend impact:
  - Elevated request volume against auth and profile RPC endpoints.
  - Unnecessary anonymous auth-user creation in Supabase during public browsing.
- Cost/risk impact:
  - Increased request noise and harder debugging.
  - Potential rate-limit pressure under sustained traffic.

## Detection
- Reported from local/preview verification while testing public profiles.
- Confirmed via browser network traces showing repeated calls after click:
  - `/auth/v1/user`
  - `rpc/get_current_user_access`
  - `profiles?select=...`
  - `rpc/profile_resolve_public_handle`

## Timeline (UTC)
- 2026-02-27 ~21:xx UTC: User reported repeated async fetches + page blinking on public profiles.
- 2026-02-27 ~22:xx UTC: Reproduced request burst after click on `/u/:username`.
- 2026-02-27 ~22:35 UTC: Root cause isolated to guest/settings sync + deferred auth bootstrap interaction path.
- 2026-02-27 ~22:40 UTC: Fix set implemented and validated locally:
  - anonymous short-circuit in access-context resolution
  - non-anonymous gating for user-settings DB sync
  - reduced public-profile reload sensitivity
- 2026-02-27 ~22:45 UTC: Regression tests and full `test:core` + `build` validation passed.

## Root Cause
Two flows combined into a feedback-like refresh chain:

1. Public/guest routes indirectly invoked user-settings DB sync code that used `ensureDbSession()`.
2. `ensureDbSession()` creates anonymous sessions when no session exists.
3. Once an anonymous session existed, auth bootstrap + access/profile refresh paths ran, including RPC/profile reads that were unnecessary for public viewing.
4. On `/u/:username`, effect dependencies tied to auth/profile object updates amplified re-fetches and visible blinking.

## Contributing Factors
- Historical assumption in runbook/code: “anonymous session for every DB operation.”
- Public-profile page effect depended on full `viewerProfile` object identity.
- Auth bootstrap on `/u/:username` was interaction-triggered rather than eager.

## What Worked
- Reproduction with click-only interaction traces made the chain obvious.
- Existing debug toggles and request grouping narrowed the trigger path quickly.
- Fixes were low-risk and testable in isolation.

## What Did Not Work
- Mixed guest/auth code paths lacked strict separation for settings/profile data.
- Public pages performed more auth-bound work than needed.

## Corrective Actions Implemented
1. `dbGetUserSettings` and `dbUpsertUserSettings` now require an existing non-anonymous session (no auto-anon provisioning).
2. `getCurrentAccessContext()` short-circuits anonymous sessions and skips `get_current_user_access` RPC for anon.
3. Auth context no longer triggers profile load for anonymous sessions.
4. App-level settings persistence only runs for authenticated non-anonymous users.
5. `/u/:username` auth bootstrap moved to critical-path bootstrap (no first-click auth surprise).
6. Public profile page effect dependencies were stabilized to avoid reloads on benign profile-object identity churn.

## Verification Checklist
1. Open `/u/<missing-handle>` signed out.
2. Click page body/background repeatedly.
3. Confirm no auth/access/profile request burst occurs.
4. Open `/u/<existing-handle>` signed in.
5. Click body/background and card non-actions.
6. Confirm no blinking/reload loop and stable network profile.

## Follow-ups
- Add lightweight telemetry counters for “anonymous auth session created on non-tool routes.”
- Add an automated browser regression for signed-in click interactions on `/u/:username` with request-count assertions.
- Continue narrowing auth-sensitive side effects on marketing/public routes.
