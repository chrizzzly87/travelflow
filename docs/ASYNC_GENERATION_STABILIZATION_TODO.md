# Async Generation Stabilization TODO Tracker

Status date: 2026-03-06

## Done
- [x] Fixed route-loader hook ordering so reopening a trip after an initial `trip = null` render no longer crashes with “Rendered more hooks than during the previous render.”
- [x] Added regression coverage for late-arriving trip props in `TripLoaderRoute`, `SharedTripLoaderRoute`, and `ExampleTripLoaderRoute`.
- [x] Allowed admin fallback retry/restart actions when admin override editing is enabled, even if the trip is otherwise locked for normal traveler edits.
- [x] Added stale local snapshot upload guard so older local queued/running trip data cannot overwrite newer terminal remote generation state.
- [x] Stabilized route view-settings forwarding to avoid duplicate emissions from unchanged payloads.
- [x] Added dedupe guard in `useTripViewSettingsSync` so unchanged normalized settings are not re-emitted when callback identities change.
- [x] Added regression coverage for no-op callback-identity rerender behavior in `useTripViewSettingsSync`.
- [x] Stabilized `App.tsx` view-settings persistence callback dependencies to avoid re-scheduling persistence work when auth access objects churn by reference.
- [x] Normalized in-memory `currentViewSettings` precision in `TripView` and added zoom-diff epsilon handling to prevent visual-history commit churn from tiny float jitter.
- [x] Tuned city panel gradient/opacity styling to avoid washed-out/dim appearance in timeline lanes.
- [x] Hardened generation-state derivation so stale queued/running metadata no longer keeps polling alive after a newer successful async result has already materialized in trip content.
- [x] Added regression coverage for stale queued metadata on already-succeeded trips so polling stops instead of continuing indefinitely.
- [x] Full regression run completed after changes (`pnpm test:core`: 184 files, 802 passed, 1 skipped).
- [x] Added draft postmortem document with commit/file inventory and incident/fix mapping (`docs/AI_TRIP_GENERATION_ASYNC_POSTMORTEM_DRAFT.md`).
- [x] Added runtime user-flow architecture charts for async generation paths (`docs/AI_TRIP_GENERATION_RUNTIME_USERFLOWS.md`).
- [x] Added App.tsx decomposition plan draft with phased extraction strategy (`docs/APP_TSX_DECOMPOSITION_PLAN.md`).

## Open
- [ ] Verify in live runtime that `user_settings` write bursts are reduced after hook dedupe patch.
- [ ] Verify in live runtime that completed trips stop generation polling/fetch loops after the stale queued/running state fallback patch.
- [ ] Verify in live runtime that admin override-enabled trips can restart generation from both the failed banner and Trip Info without disabled-state drift.
- [ ] Validate city panel color tuning against real generated trips in production preview.
- [ ] Produce postmortem package for browser -> async worker migration:
  - [x] complete commit/file/SQL change inventory
  - [x] user-flow architecture chart (route open -> checks -> outcomes)
  - [ ] risk/optimization follow-ups
- [x] Create App.tsx decomposition plan (module extraction map + phased refactor steps).
