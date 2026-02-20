# Guest Onboarding + Queue Handoff Hardening (Deferred)

## Status
Open issue (deferred). Keep current behavior for testing until production user traffic ramps.

## Current Contract (Implemented)
1. Anonymous users can start trip generation from `/create-trip`.
2. Generation enters a loading shell, then the request is queued in `trip_generation_requests`.
3. Users are prompted to sign in/register to continue.
4. Login resumes with `claim=<requestId>` and processes queued generation.
5. Successful claim redirects to the generated trip (`/trip/:id`).
6. Required onboarding is enforced only for authenticated non-anonymous users, and public planner-entry routes remain onboarding-exempt (`/create-trip`, `/trip/*`, `/s/*`, `/example/*`).

## Deferred Hardening Work
1. Add explicit server-side guardrails that prevent onboarding enforcement for anonymous/guest sessions under all edge cases.
2. Add end-to-end tests for guest queue handoff (queue created -> auth -> claim -> trip open).
3. Add fallback/recovery UX for claim failures (expired request, duplicate claim, generation error).
4. Add instrumentation dashboard for queue conversion funnel (queued, auth start, auth success, claim success, trip open).
5. Add cleanup + abuse protections (rate-limits and queue TTL strategy validation under load).
6. Validate mobile and low-bandwidth UX timing so loading shell + auth prompt feel intentional and not broken.

## Notes
- Keep guest creation path enabled during current test phase.
- Revisit this backlog before production acquisition campaigns.
