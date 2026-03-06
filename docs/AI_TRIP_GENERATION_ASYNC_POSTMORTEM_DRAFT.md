# AI Trip Generation Async Migration Postmortem (Draft)

Status: draft  
Date: 2026-03-06  
Branch context: `codex/failed-generation-observability-retry-core-final`

## 1. Goal
Move trip generation from browser-owned execution to server/worker-owned execution so generation is not blocked by tab lifecycle, and make failures diagnosable/retryable on the same trip.

## 2. What changed (this branch delta)
Commits ahead of `origin/main`:
1. `7c53505d` Fix async worker deploy wiring and stop polled trip sync loops
2. `5df6685a` Fix async worker lease reclaim and claim diagnostics
3. `dc73b0c5` Auto-requeue expired leased jobs before worker claim
4. `590e84cc` Harden async worker triggering and stale attempt handling
5. `721d643e` Harden async retry state handling and worker timeout
6. `beffa371` Align worker trigger timeout budget with async runtime
7. `91642bd3` Fix queued retry deadlocks and worker supersede races
8. `e11bcf13` Fix TripView generation orchestration init order crash
9. `ed5d8192` Harden async generation polling, queue checks, and worker persistence
10. `b22bcc82` Reduce trip view sync request loops and guard stale bootstrap uploads
11. `ccde12ab` Reduce idle trip sync churn and strengthen city panel visuals

## 3. File change inventory (this branch delta)
- `netlify/edge-functions/ai-generate-worker.ts`: worker trigger/processing hardening.
- `netlify/edge-lib/ai-provider-runtime.ts`: provider runtime timeout/runtime-safe behavior alignment.
- `services/tripGenerationAsyncEnqueueService.ts`: enqueue correctness + failure handling.
- `services/tripGenerationJobService.ts`: queue job state handling and worker trigger integration.
- `services/tripGenerationRetryService.ts`: retry race/in-flight and canonical-attempt protections.
- `services/tripGenerationPollingService.ts`: polling-apply guards and stale/in-flight conflict handling.
- `services/dbService.ts`: stale local overwrite prevention and persistence safety.
- `components/TripView.tsx`: generation polling/orchestration/runtime protections and visual-commit churn reduction.
- `components/tripview/useTripViewSettingsSync.ts`: normalized no-op dedupe for settings emissions.
- `components/tripview/viewChangeDiff.ts`: zoom-jitter diff suppression.
- `routes/TripLoaderRoute.tsx`, `routes/SharedTripLoaderRoute.tsx`, `routes/ExampleTripLoaderRoute.tsx`: view-settings forwarding dedupe/stability.
- `App.tsx`: user-settings persistence callback stability/dedupe hardening.
- `components/TimelineBlock.tsx`: stronger city color rendering (removed washed-out look).
- `config/aiModelCatalog.ts`: model baseline/runtime catalog updates.
- tests:
  - `tests/services/tripGenerationAsyncEnqueueService.test.ts`
  - `tests/services/tripGenerationJobService.test.ts`
  - `tests/services/tripGenerationRetryService.test.ts`
  - `tests/unit/tripGenerationPollingService.test.ts`
  - `tests/unit/dbService.uploadLocalTripSnapshot.test.ts`
  - `tests/browser/tripview/useTripViewSettingsSync.browser.test.ts`
  - `tests/browser/routes/tripLoaderRoute.browser.test.ts`
  - `tests/unit/viewChangeDiff.test.ts`
  - `tests/unit/aiProviderRuntime.test.ts`
  - `tests/unit/aiModelCatalog.test.ts`

## 4. SQL / RPC / schema dependencies
This branch assumes async-generation DB primitives are already present in the shared Supabase schema (from prior migration commits/rollout), including queue and attempt RPC contracts used by:
- generation attempt start/finish logging
- queue enqueue/claim/lease/retry lifecycle
- trip read/update persistence for generation metadata

Verification command set:
1. `pnpm supabase:validate`
2. Validate RPC presence and signatures used by runtime (`trip_generation_attempt_start`, enqueue/claim/lease/finish related functions).
3. Validate no duplicate overload ambiguity for admin RPCs.

## 5. Main incidents observed and fixes
1. **Trip enqueue races (`Trip not found`)**
- Cause: attempt logging/enqueue before canonical trip persistence.
- Fix: persist canonical trip before attempt start/enqueue; guard retry similarly.

2. **Optimistic attempt ID drift**
- Cause: enqueue/retry using client optimistic IDs.
- Fix: require canonical server-logged attempt IDs before enqueue.

3. **Leased/queued deadlocks**
- Cause: expired leases not reclaimed or claim path not robust enough.
- Fix: reclaim expired leased jobs and auto-requeue claimable stalled jobs.

4. **Worker trigger/runtime mismatch**
- Cause: trigger budget vs provider runtime budget mismatch.
- Fix: align worker/trigger timeout budget and runtime-safe provider timeout handling.

5. **Stale snapshot overwrites**
- Cause: local queued snapshots overwriting newer remote terminal state.
- Fix: bootstrap upload guard skips stale local in-flight snapshots when remote is newer/terminal.

6. **Idle commit/request churn**
- Cause: settings callback identity churn + tiny view jitter causing repeated diff/commit cycles.
- Fix: normalized no-op dedupe in settings sync, App callback stabilization, zoom diff epsilon/normalization.

## 6. Validation executed
- `pnpm test:core` => passed (`184` files, `802` tests passed, `1` skipped).
- `pnpm updates:validate` => passed.
- Targeted regression tests for settings/diff/polling passed.

## 7. Remaining open risks
- Live verification still needed for:
  - reduced `user_settings` write bursts on long-lived trip pages,
  - fully stopping idle polling/fetch churn across all terminal-state trip scenarios,
  - city color tuning acceptance on real generated data.

## 8. Recommended next checks (production-like)
1. Open a terminal-state trip for 2-3 minutes and inspect network request count trend.
2. Open queued/running trip, refresh during run, verify state converges without duplicate retries.
3. Retry failed trip once from fresh load and verify no first-click no-op flash.
4. Validate worker logs for claim/process completion and queue drain.

## 9. Rollback strategy (if regression appears)
1. Disable worker trigger path and retry-nudge path via runtime flags/env controls.
2. Keep generation metadata writes but suspend auto-retry worker kick.
3. Re-enable browser fallback only for controlled emergency window (if still available in deployed code path).
4. Re-run queue reconciliation scripts before re-enabling async worker.
