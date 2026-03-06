# Async Generation Stabilization TODO Tracker

Status date: 2026-03-06

## Done
- [x] Added stale local snapshot upload guard so older local queued/running trip data cannot overwrite newer terminal remote generation state.
- [x] Stabilized route view-settings forwarding to avoid duplicate emissions from unchanged payloads.
- [x] Added dedupe guard in `useTripViewSettingsSync` so unchanged normalized settings are not re-emitted when callback identities change.
- [x] Added regression coverage for no-op callback-identity rerender behavior in `useTripViewSettingsSync`.
- [x] Stabilized `App.tsx` view-settings persistence callback dependencies to avoid re-scheduling persistence work when auth access objects churn by reference.
- [x] Normalized in-memory `currentViewSettings` precision in `TripView` and added zoom-diff epsilon handling to prevent visual-history commit churn from tiny float jitter.
- [x] Tuned city panel gradient/opacity styling to avoid washed-out/dim appearance in timeline lanes.
- [x] Full regression run completed after changes (`pnpm test:core`: 184 files, 802 passed, 1 skipped).

## Open
- [ ] Verify in live runtime that `user_settings` write bursts are reduced after hook dedupe patch.
- [ ] Continue trip generation polling stabilization for completed trips (stop unnecessary polling/fetch loops on terminal state).
- [ ] Validate city panel color tuning against real generated trips in production preview.
- [ ] Produce postmortem package for browser -> async worker migration:
  - [ ] complete commit/file/SQL change inventory
  - [ ] user-flow architecture chart (route open -> checks -> outcomes)
  - [ ] risk/optimization follow-ups
- [ ] Create App.tsx decomposition plan (module extraction map + phased refactor steps).
