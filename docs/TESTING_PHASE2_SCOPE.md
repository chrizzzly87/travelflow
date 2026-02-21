# Phase 2 Testing Scope: UI Orchestration (TripView + Route Loaders)

## Objective
Expand coverage beyond pure/service modules to the highest-risk React orchestration layer so route hydration, auth/paywall transitions, and view-state synchronization regressions are caught before deploy.

## In Scope
- `/Users/chrizzzly/.codex/worktrees/47a9/travelflow-codex/components/TripView.tsx`
- `/Users/chrizzzly/.codex/worktrees/47a9/travelflow-codex/components/tripview/*.tsx`
- `/Users/chrizzzly/.codex/worktrees/47a9/travelflow-codex/components/tripview/*.ts`
- `/Users/chrizzzly/.codex/worktrees/47a9/travelflow-codex/routes/TripLoaderRoute.tsx`
- `/Users/chrizzzly/.codex/worktrees/47a9/travelflow-codex/routes/ExampleTripLoaderRoute.tsx`
- `/Users/chrizzzly/.codex/worktrees/47a9/travelflow-codex/routes/SharedTripLoaderRoute.tsx`

## Test Strategy
1. Route-loader integration tests
- Render each loader route with controlled params and mocked service dependencies.
- Verify success, missing-resource, malformed-data, and permission-denied flows.
- Assert redirect/fallback behavior cannot create open-redirect-style paths.

2. TripView orchestration tests
- Validate URL/view-settings sync and persisted state hydration behavior.
- Verify paywall/expiry banner and lock-state transitions at boundary timestamps.
- Assert history/undo-redo orchestration and event dispatch paths remain stable.
- Verify auth-driven UI state transitions (guest/login/logout/admin override) without navigation regressions.

3. Hook-level regression tests
- Prioritize extracted hooks under `/components/tripview/` that coordinate state across timeline/map/panels.
- Cover race-prone effects (async load, delayed map bootstrap, route remount lifecycle).

## Tooling Guidance
- Use Vitest with `jsdom` for component/hook tests.
- Add React Testing Library for user-centric interaction assertions where needed.
- Keep fast pure-module tests in `tests/unit/**`; keep UI orchestration tests in `tests/browser/**`.

## Initial Regression Matrix
- Loader receives invalid compressed trip payload: route recovers with safe fallback UI.
- Shared-trip load with unauthorized access: route shows access guard state, no crash.
- Expiry boundary equals now: trip is treated as expired consistently across loader and TripView.
- Back/forward navigation after edits: history state and rendered timeline stay in sync.
- Trip view mode toggle + remount: selected mode restores correctly from URL/local state contract.

## Exit Criteria
- High-risk TripView and loader paths covered by deterministic tests for success + failure states.
- No flaky timers/network coupling in CI runs.
- `pnpm test:core` remains green and at least one `pnpm test:run` suite includes route/TripView orchestration tests.
