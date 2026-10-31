# Async Worker Watchdog, Worker Health, and Canary Hardening

## Status
Issue [#264](https://github.com/chrizzzly87/travelflow/issues/264), shipped in #265 and closed.

**Status (2026-10-24):** done. The cron (`netlify/functions/ai-generate-worker-cron.js`, every
minute) writes heartbeat, watchdog and canary rows to `async_worker_health_checks`
(`docs/supabase.sql`); the summary rules live in `netlify/edge-lib/async-worker-health.ts`
(heartbeat stale after 3 min, canary every 15 min and stale after 30 min). The admin screen is
**Worker health** (`/admin/ai-benchmark/worker-health`, sidebar section Tools): one verdict header
(Healthy / Degraded / Failing, with the server's reason) over four signals — heartbeat, queue,
canary, self-heal — and a sortable, filterable, paged table of the latest 50 checks. It links to
**AI telemetry** and back. The scope below is kept as the original plan.

## Objective
Detect, surface, and automatically mitigate async worker stalls before queued trip-generation jobs pile up in production.

## Why
The March 10, 2026 production incident showed two separate gaps:
1. Queue drain regressions can leave jobs stuck in `queued` without a durable worker-health surface.
2. Operators had to inspect raw queue rows and manually re-run worker logic to prove whether cron and background dispatch were still healthy.

## Scope
### 1) Durable worker health rows
- Add `async_worker_health_checks` for:
  - cron heartbeats
  - stale-queue watchdog incidents
  - end-to-end canary runs

### 2) Scheduled watchdog
- Inspect `trip_generation_jobs` for stale queued work:
  - `state = 'queued'`
  - `run_after <= now()`
  - `updated_at` older than 5 minutes
- Record counts and oldest queued age.
- Reuse the existing worker dispatch path as the bounded self-heal action.

### 3) Scheduled canary
- Create a disposable invalid-payload job that should deterministically fail with `ASYNC_WORKER_PAYLOAD_INVALID`.
- Run it through the real cron-to-background-worker drain path.
- Record latency and pass/fail status.

### 4) Admin surface
- Add `/admin/ai-benchmark/worker-health`.
- Show current status, latest heartbeat, stale queued count, latest self-heal, latest canary, and recent health rows.
  (Shipped as one status header with four signals rather than six tiles; see Status.)

## Acceptance Criteria
1. Stale queued jobs older than 5 minutes are visible in admin.
2. Cron heartbeat health is visible within one refresh cycle.
3. Canary success proves end-to-end worker drain at least every 15 minutes.
4. Regressions create durable `warning` or `failed` worker-health rows.

## Implementation Notes
- Use one dedicated internal admin edge endpoint for worker-health reads.
- Keep canary traffic provider-free by relying on the existing invalid-payload failure path.
- Clean up successful canary artifacts so user trip tables do not accumulate synthetic rows.
