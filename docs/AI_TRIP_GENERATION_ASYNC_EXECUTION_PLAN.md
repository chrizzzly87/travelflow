# AI Trip Generation: Asynchronous Server-Owned Execution Plan

## Status
Proposed architecture plan. Target: remove dependency on a user keeping the tab open.

## Problem Statement
Today, trip generation is partially edge-backed but still client-orchestrated for completion and persistence. If the tab closes at the wrong moment, generation completion and trip persistence are not guaranteed.

## Goals
1. Generation must complete without requiring an open browser tab.
2. Trip persistence must be server-owned and idempotent.
3. Retry must be server-owned, same trip ID, and fully auditable.
4. User/admin UX remains responsive via polling or realtime updates.
5. Existing lifecycle status (`active|expired|archived`) remains unchanged; generation state remains separate.

## Non-Goals
1. Replacing current trip data model (`trips.data`) in this phase.
2. Rewriting benchmark runtime in this phase.
3. Introducing additional lifecycle values (no `failed` lifecycle status).

## Target Architecture
1. **Submit endpoint (fast)**
- Client submits generation request + normalized input snapshot.
- Server immediately creates/updates trip placeholder and attempt row in `running` state.
- Server returns `tripId`, `attemptId`, `requestId` quickly.

2. **Async worker execution (durable)**
- Background worker reads pending/running jobs.
- Calls provider runtime (OpenRouter/provider adapter).
- Parses/validates/normalizes result.
- Writes success/failure diagnostics and final trip payload server-side.

3. **Client as observer**
- Client does not own completion.
- Client observes status by polling `trip_generation_attempts` or realtime subscription.
- UI transitions on server truth (`queued/running/succeeded/failed`).

4. **Retry as job enqueue**
- Retry action enqueues a new attempt for same `tripId`.
- Uses default model by default; admin can override model.
- Worker processes retry same as initial attempt.

## Data Contract
### Existing tables reused
- `trips`
- `trip_versions`
- `trip_generation_attempts`
- `ai_generation_events`

### New/extended table
Add `trip_generation_jobs` (server queue):
- `id uuid pk`
- `trip_id text not null`
- `attempt_id uuid not null`
- `owner_id uuid not null`
- `state text check (queued|leased|completed|failed|dead)`
- `priority integer default 100`
- `lease_expires_at timestamptz`
- `run_after timestamptz`
- `retry_count integer default 0`
- `max_retries integer default 3`
- `last_error_code text`
- `last_error_message text`
- `payload jsonb not null` (input snapshot + model target + context)
- `created_at/updated_at`

Indexes:
- `(state, run_after, priority, created_at)`
- `(trip_id, created_at desc)`
- `(owner_id, created_at desc)`

## API / RPC Plan
1. `trip_generation_enqueue(p_trip_id, p_input_snapshot, p_target, p_source, p_retry_of_attempt_id)`
- Owner/admin-safe.
- Creates `trip_generation_attempts` row + queue job in single transaction.
- Marks trip generation state `queued/running` and stores snapshot if missing.

2. `trip_generation_job_claim(p_worker_id, p_lease_seconds)`
- Internal service role only.
- Atomically claims next job with lease.

3. `trip_generation_job_complete(p_job_id, p_result_json, p_meta)`
- Internal service role only.
- Writes trip payload + version + attempt success.

4. `trip_generation_job_fail(p_job_id, p_failure, p_retry_policy)`
- Internal service role only.
- Writes attempt failure, updates job retry/dead state.

5. Read RPCs
- Keep owner/admin attempt listing RPCs.
- Add lightweight `trip_generation_status_owner(p_trip_id)` for polling.

## Worker Runtime Plan
Preferred implementation:
1. Netlify Background Function (or scheduled edge + durable lease loop) for execution.
2. Service-role DB client only in worker.
3. Strict lease semantics to avoid double processing.
4. Heartbeat/lease extension for long runs.
5. Dead-letter transition after retry budget exhaustion.

## State Machine
1. Submit: `queued` -> `running`
2. Success: `running` -> `succeeded`
3. Failure recoverable: `running` -> `failed` + job `queued` (retry)
4. Failure terminal: `running` -> `failed` + job `dead`
5. Abort/manual cancel (future): `running|queued` -> `failed` (`failure_kind=abort`)

## UX Contract
1. Opening a failed trip must never show endless planning overlay.
2. Planning overlay appears only for `queued|running` state.
3. Retry from Trip View and Trip Info enqueues async server job.
4. Retry re-triggers tab feedback animation and running overlays.
5. Attempt history remains append-only and visible.

## Migration Plan
1. **Phase 1: Dual-write foundation**
- Keep current flow.
- Add queue table + enqueue RPC + worker skeleton.
- Write attempt/job rows in parallel (no cutover).

2. **Phase 2: Server completion ownership**
- Move completion writes to worker for selected flow (`classic`).
- Client switches to observer mode for `classic`.

3. **Phase 3: Full flow cutover**
- Cut over `wizard/surprise` and queue-claim paths.
- Remove client-owned completion paths.

4. **Phase 4: Hardening**
- Add dead-letter admin UI view.
- Add operational alerts and SLO dashboards.

## Idempotency and Safety
1. Use `requestId` + `attemptId` idempotency key across submission/worker.
2. Reject duplicate completion for terminal attempts.
3. Ensure trip writes are versioned and transactional with attempt state updates.
4. Enforce owner/admin permissions at enqueue layer only; worker runs service-role internal.

## Operational SLOs
1. Job pickup latency P95 < 5s.
2. End-to-end generation latency P95 < 75s (model-dependent).
3. Duplicate completion rate = 0.
4. Stuck running attempts older than 2x timeout = 0 (auto-reconciled).

## Test Plan
1. Unit
- queue ordering and lease claim idempotency
- retry/backoff/dead-letter transitions
- completion/failure transaction invariants

2. Integration
- enqueue -> worker -> succeeded path
- enqueue -> worker failure -> retry -> success
- enqueue -> worker failure -> dead path

3. Browser/E2E
- close tab during running; generation still finishes server-side
- offline client during running; reopen and observe final state
- Supabase degraded/offline simulation with eventual consistency behavior
- retry same trip ID from failed state

4. Regression
- failed trips keep title/metadata
- failed trips do not display running overlay
- attempt timeline remains complete

## Rollout / Feature Flags
1. `ai_generation_async_worker_enabled`
2. `ai_generation_async_flow_classic_enabled`
3. `ai_generation_async_retry_enabled`

## Risks and Mitigations
1. Worker concurrency race
- Use DB lease + transactional claim.
2. Cost spikes from retries
- bounded retry budget + model fallback policy.
3. Data drift between attempt and trip metadata
- single transaction updates and reconciliation job.

## Acceptance Criteria
1. Generation completes after tab close in production.
2. Trip and diagnostics are persisted server-side for every attempt.
3. Retry no longer depends on active tab lifecycle.
4. UI consistently reflects server attempt state transitions.
