# AI Trip Generation Merge Readiness Audit

Status: draft  
Date: 2026-03-07  
Branch: `codex/failed-generation-observability-retry-core-final`

## Purpose
This document answers one narrow question:

> Which parts of the original failed-generation + async-worker scope are complete enough to merge, and which parts are still follow-up work?

It exists because the original feature was shipped in multiple PR phases and then heavily hardened after merge.

## Inputs reviewed
- [docs/AI_TRIP_GENERATION_ASYNC_POSTMORTEM_DRAFT.md](/Users/chrizzzly/.codex/worktrees/bece/travelflow-codex/docs/AI_TRIP_GENERATION_ASYNC_POSTMORTEM_DRAFT.md)
- [docs/AI_TRIP_GENERATION_RUNTIME_USERFLOWS.md](/Users/chrizzzly/.codex/worktrees/bece/travelflow-codex/docs/AI_TRIP_GENERATION_RUNTIME_USERFLOWS.md)
- [docs/ASYNC_GENERATION_STABILIZATION_TODO.md](/Users/chrizzzly/.codex/worktrees/bece/travelflow-codex/docs/ASYNC_GENERATION_STABILIZATION_TODO.md)
- [content/updates/2026-03-03-failed-trip-generation-observability-retry.md](/Users/chrizzzly/.codex/worktrees/bece/travelflow-codex/content/updates/2026-03-03-failed-trip-generation-observability-retry.md)
- current branch code + tests

## Merge-ready core scope

### Async worker migration
- Placeholder trip is persisted before enqueue.
- Attempt logging is durable and tied to the same trip.
- Queue job enqueue exists and uses canonical attempt IDs.
- Worker processing runs in the background-function path instead of relying on the edge response window.
- Retry uses the same trip ID and re-enqueues server-owned work.
- Trip pages poll queued/running server state and converge to terminal success/failure.

### Failure observability
- Generation state is separate from lifecycle status.
- Failed trips remain visible as failed instead of being overwritten by generic error titles.
- Trip details surface provider/model/request/timing/failure details.
- Attempt history is kept and retry evidence is not erased.

### Retry UX
- Travelers can retry from failed trip surfaces.
- Admin override editing can restart failed generation in fallback/read-only situations.
- Retry no longer depends on stale optimistic attempt IDs.

### Stability hardening already landed on this branch
- stale queued/running metadata is prevented from masking completed trips forever
- stale local queued snapshots no longer overwrite newer terminal remote state
- duplicate retry/bootstrap request bursts are reduced
- local cache quota failures are handled more gracefully
- finished trips no longer keep obvious generation polling alive
- local Vite worker proxy behavior is documented and dev error messaging is explicit

## Admin scope status

### Already complete enough for merge
- read-only pills in trips table
- lifecycle/expiry editing moved into drawer
- generation diagnostics in admin trip details
- sticky-column/table hardening
- audit diff modal layout stabilization

### Still follow-up / non-blocking
- some release-note admin `[ ]` lines are stale bookkeeping and should be reconciled later
- admin docs/playground/table guidance exists, but bookkeeping in the release note has not been fully normalized

## Items treated as follow-up, not merge blockers
- further request-churn reduction on long-lived finished trips
- further `user_settings` traffic reduction if any residual churn remains
- additional dead-letter/admin requeue ergonomics beyond the current operational surface
- benchmark import/preset polish
- best-effort abort beacon enrichment
- postmortem risk/optimization appendix completion

## True open verification tasks
These are still worth checking on production-like runtime, but they are verification tasks rather than known correctness failures.

- trip/share/example first paint no longer flashes the half-screen grey bootstrap block
- finished trips stay quiet after settling
- My Trips sidebar does not trigger cosmetic remote trip writes
- admin override restart stays enabled where expected

## Stale checklist warning
The release note file still contains many `[ ] [Internal]` lines that are already implemented in code and covered by the hardening chain. It was used as a working ledger during the migration, so checkbox state is no longer a reliable indicator of implementation status.

Use this document plus the postmortem inventory instead of treating every unchecked release-note line as unfinished product work.

## Current recommendation
Recommendation: merge-ready for the async worker migration and failed-generation core feature, assuming the latest production verification stays green.

Rationale:
- the original core problem is solved: generation is no longer browser-tab-owned
- retry/failure visibility is working on the same trip record
- the major correctness regressions discovered during rollout were hardened with targeted fixes and regression coverage
- remaining items are mostly cleanup, ergonomics, or verification

## Before merge to `main`
1. Keep the latest production smoke test focused on:
   - fresh create-trip
   - retry failed trip
   - reopen queued/running trip after tab close
   - finished trip idle request behavior
2. If those stay green, the branch can merge as the hardening follow-up to the already-merged core PR.
