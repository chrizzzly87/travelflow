# Async Generation Stabilization TODO Tracker

Status date: 2026-03-06

## Done
- [x] Fixed local `pnpm dev:netlify` edge-function startup by correcting the TSX generic syntax in `trip-og-image.tsx`, so async worker and map-preview routes load again in Netlify dev.
- [x] Split the async generation worker into a fast edge dispatcher plus direct background-function processing, so provider execution no longer depends on the edge response window.
- [x] Raised async provider timeout budget to a slower-model-safe range in the background worker runtime and aligned lease duration with that budget.
- [x] Reduced queued-trip worker nudges and generation polling cadence in `TripView` to cut redundant request churn while async jobs are in flight.
- [x] Added unit regressions for edge-dispatch + direct-background worker processing behavior.
- [x] Expanded stale success derivation so completed trips fall back to `succeeded` when `generatedAt` proves the visible itinerary is newer than a stale queued/running attempt, even if `lastSucceededAt` is missing.
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
- [x] Deepened city lane color treatment so Tailwind `bg-100` palette tokens no longer get lightened into near-white timeline panels.
- [x] Hardened generation-state derivation so stale queued/running metadata no longer keeps polling alive after a newer successful async result has already materialized in trip content.
- [x] Added regression coverage for stale queued metadata on already-succeeded trips so polling stops instead of continuing indefinitely.
- [x] Kept Trip Manager country enrichment local-only so opening My Trips no longer writes cosmetic country metadata back to the remote trip row.
- [x] Gated view-settings persistence and visual history commits behind explicit manual interactions so auto-fit/layout settling no longer looks like a user edit.
- [x] Treat queued/running async metadata as terminal success when real itinerary content is already visible and there is no explicit newer retry intent, cutting off stale finished-trip polling loops.
- [x] Full regression run completed after changes (`pnpm test:core`: 184 files, 802 passed, 1 skipped).
- [x] Added draft postmortem document with commit/file inventory and incident/fix mapping (`docs/AI_TRIP_GENERATION_ASYNC_POSTMORTEM_DRAFT.md`).
- [x] Added runtime user-flow architecture charts for async generation paths (`docs/AI_TRIP_GENERATION_RUNTIME_USERFLOWS.md`).
- [x] Added App.tsx decomposition plan draft with phased extraction strategy (`docs/APP_TSX_DECOMPOSITION_PLAN.md`).

## Open
- [ ] Redeploy production with the background-worker split so live create/retry runs are no longer capped by the old 20s edge timeout.
- [ ] Verify in live runtime that fresh create-trip runs complete under the new background worker path instead of timing out at 20s.
- [ ] Verify in live runtime that retry-triggered worker nudges no longer flood repeated trip fetches while a queued job waits to start.
- [ ] Verify in live runtime that `user_settings` write bursts are reduced after hook dedupe patch.
- [ ] Verify in live runtime that completed trips stop generation polling/fetch loops after the stale queued/running state fallback patch.
- [ ] Verify in live runtime that My Trips no longer triggers remote trip write churn from country enrichment.
- [ ] Verify in live runtime that admin override-enabled trips can restart generation from both the failed banner and Trip Info without disabled-state drift.
- [ ] Validate city panel color tuning against real generated trips in production preview.
- [ ] Produce postmortem package for browser -> async worker migration:
  - [x] complete commit/file/SQL change inventory
  - [x] user-flow architecture chart (route open -> checks -> outcomes)
  - [ ] risk/optimization follow-ups
- [x] Create App.tsx decomposition plan (module extraction map + phased refactor steps).
