# AI Trip Generation Async Migration Postmortem (Draft)

Status: draft  
Date: 2026-03-06  
Branch context: `codex/failed-generation-observability-retry-core-final`

## 1. Goal
Move trip generation from browser-owned execution to server/worker-owned execution so generation is not blocked by tab lifecycle, and make failures diagnosable/retryable on the same trip.

## 2. Git-sourced inventory and timeline
This section is intentionally literal. It is derived from `git log` so the document can be used for rollback analysis without reconstructing history from memory.

### 2.1 Related PR merges already landed on `main`
1. `f8a6c4f` · 2026-03-05 · Merge pull request #242 from `codex/admin-table-audit-stabilization`
2. `c2f4bc9` · 2026-03-05 · Merge pull request #243 from `codex/admin-playground-docs-table-guidance`
3. `b864052` · 2026-03-05 · Merge pull request #244 from `codex/failed-generation-observability-retry-core-final`

### 2.2 Intervening mainline merges that happened while this feature branch was still being hardened
1. `cd3c4a3` · 2026-03-05 · Merge pull request #245 from `codex/admin-dashboard-stacked-date-scroll`
2. `271e96e` · 2026-03-05 · Merge pull request #246 from `codex/publish-admin-dashboard-update`
3. `cc04a5d` · 2026-03-05 · Merge pull request #247 from `codex/legacy-failed-trip-state`
4. `2acce1d` · 2026-03-05 · Merge remote-tracking branch `origin/main` into `codex/failed-generation-observability-retry-core-final`

### 2.3 Complete commit inventory for the async-generation migration and hardening chain
From `30afcf43` forward:
1. `054052b` · 2026-03-05 · Add async generation job queue foundations and service adapters
2. `79cb105` · 2026-03-05 · Add async queued-generation worker path and classic queue enqueue flag
3. `f96ad3d` · 2026-03-05 · Poll server trip updates while async generation is in flight
4. `61b1ce2` · 2026-03-05 · Gate classic create flow to async worker enqueue path
5. `df224cc` · 2026-03-05 · Extend async queue worker flow support to wizard and surprise claims
6. `eb8de44` · 2026-03-05 · Add async retry enqueue path with queued-state UX handling
7. `90f6591` · 2026-03-05 · Admin dashboard stacked trend charts, DD.MM labels, and table scroll fix
8. `cd3c4a3` · 2026-03-05 · Merge pull request #245 from `codex/admin-dashboard-stacked-date-scroll`
9. `bbec10b` · 2026-03-05 · Publish admin dashboard release note metadata
10. `271e96e` · 2026-03-05 · Merge pull request #246 from `codex/publish-admin-dashboard-update`
11. `a5356cf` · 2026-03-05 · Add admin dead-letter job visibility for trip generation diagnostics
12. `efb3098` · 2026-03-05 · Cut over create-trip variants to async worker enqueue
13. `a590884` · 2026-03-05 · Add admin dead-letter requeue action for generation jobs
14. `344db21` · 2026-03-05 · Enable async worker enqueue in main create-trip form
15. `a73d340` · 2026-03-05 · fix: mark legacy loading-error trips as failed
16. `cc04a5d` · 2026-03-05 · Merge pull request #247 from `codex/legacy-failed-trip-state`
17. `5eaaa75` · 2026-03-05 · Retire obsolete create-trip labs and add wizard CTA
18. `8e96191` · 2026-03-05 · Prune retired create-trip flow modules and tests
19. `2acce1d` · 2026-03-05 · Merge remote-tracking branch `origin/main` into `codex/failed-generation-observability-retry-core-final`
20. `0c095e7` · 2026-03-05 · Finalize async-only trip generation execution and diagnostics
21. `d7be77b` · 2026-03-05 · Ensure generation logging/enqueue initializes db session
22. `aaedb64` · 2026-03-05 · Redirect create-trip to login when async enqueue lacks DB session
23. `27b363e` · 2026-03-05 · Gate wizard generation behind writable DB session
24. `c98eb94` · 2026-03-05 · Queue anonymous trip generation requests until auth claim
25. `ea86812` · 2026-03-05 · Add global auth-claim generation completion toasts
26. `4f87aee` · 2026-03-06 · Fix missing i18n binding in TripView
27. `1f8f076` · 2026-03-06 · Fix TripView TDZ toast crash on auth-claim action
28. `0f76b47` · 2026-03-06 · Fix async enqueue RPC attempt_id conflict ambiguity
29. `f951d96` · 2026-03-06 · Harden async trip generation enqueue and worker RPC handling
30. `9249a6d` · 2026-03-06 · Fix retry feedback lifecycle and stop stale generation polling
31. `6e7659f` · 2026-03-06 · Require canonical retry attempt id before async enqueue
32. `3b317ce` · 2026-03-06 · Harden local trip cache writes under storage quota
33. `924fb5e` · 2026-03-06 · Stabilize async retry execution and move worker trigger to background
34. `7c53505` · 2026-03-06 · Fix async worker deploy wiring and stop polled trip sync loops
35. `5df6685` · 2026-03-06 · Fix async worker lease reclaim and claim diagnostics
36. `dc73b0c` · 2026-03-06 · Auto-requeue expired leased jobs before worker claim
37. `590e84c` · 2026-03-06 · Harden async worker triggering and stale attempt handling
38. `721d643` · 2026-03-06 · Harden async retry state handling and worker timeout
39. `beffa37` · 2026-03-06 · Align worker trigger timeout budget with async runtime
40. `91642bd` · 2026-03-06 · Fix queued retry deadlocks and worker supersede races
41. `e11bcf1` · 2026-03-06 · Fix TripView generation orchestration init order crash
42. `ed5d819` · 2026-03-06 · Harden async generation polling, queue checks, and worker persistence
43. `b22bcc8` · 2026-03-06 · Reduce trip view sync request loops and guard stale bootstrap uploads
44. `ccde12a` · 2026-03-06 · Reduce idle trip sync churn and strengthen city panel visuals
45. `7f360e6` · 2026-03-06 · Add async generation postmortem and architecture docs
46. `36cd717` · 2026-03-06 · Stop stale success polling and align worker city colors

### 2.4 Additional hardening commits after the inventory refresh started
1. `0a20729` · 2026-03-06 · Fix trip loader hook order and admin retry gating
2. `9b70a57` · 2026-03-06 · Fix local async worker routing in Vite dev
3. `17f1c77` · 2026-03-06 · Fix async worker runtime path and local Netlify dev startup

### 2.5 Why this section matters
- It separates already-merged PRs from post-merge hardening on the still-open branch.
- It preserves intervening unrelated merges (#245, #246, #247) so later analysis does not assume a linear isolated feature rollout.
- It gives a literal change sequence that can be replayed, bisected, or partially reverted.

## 3. File change inventory (this branch delta)
- `netlify/edge-functions/ai-generate-worker.ts`: worker trigger/processing hardening.
- `netlify/functions/ai-generate-worker-background.js`: background worker execution path now processes jobs directly instead of proxying back into the edge worker route.
- `netlify/edge-functions/trip-og-image.tsx`: Netlify local edge startup syntax fix for TSX generic parsing.
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

7. **Local Netlify dev worker routes failed to load**
- Cause: `trip-og-image.tsx` used a TSX-invalid generic arrow signature, which prevented edge-function startup and left local `/api/internal/ai/generation-worker` routing unavailable.
- Fix: correct the TSX generic syntax and verify Netlify dev loads worker + preview edge routes again.

8. **Async provider execution still timed out at edge-response limits**
- Cause: the “background” worker function proxied back into the edge worker route, so heavy provider execution still effectively lived in the edge runtime and hit the 20s timeout budget.
- Fix: move the heavy execution path into direct background-function processing, keep the edge route as a fast dispatcher, raise provider timeout to a background-safe range, and reduce UI nudge/poll pressure while jobs are queued.

## 6. Validation executed
- `pnpm test:core` => passed (`184` files, `802` tests passed, `1` skipped).
- `pnpm test:core` => passed (`184` files, `812` tests passed, `1` skipped) after local-dev + background-worker split hardening.
- `pnpm updates:validate` => passed.
- `pnpm edge:validate` => passed.
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
