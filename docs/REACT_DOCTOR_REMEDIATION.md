# React Doctor Remediation

Issue: #350
PR: #351
Branch: `codex/react-doctor-core-pages`

## Goal

Improve React Doctor health across the full repository while keeping this PR focused on findings surfaced by the scanner. The working target for this remediation is:

- Required: zero React Doctor error findings in the diff scan.
- Required: zero React Doctor error findings in the full scan.
- Target: move the full repository score toward `60 / 100` without broad visual churn.
- Guardrail: only change files that React Doctor flagged or repo instructions require.

## Current Score Snapshot

Latest scanner used: `react-doctor v0.1.4`, resolved through `pnpm dlx react-doctor@latest`.

- Initial user baseline: `49 / 100`, `73` errors, `5749` warnings, `356/814` files.
- After core-page fixes: `51 / 100`, `33` errors, `5752` warnings, `356/821` files.
- Current full scan: `54 / 100`, `0` errors, `5745` warnings, `354/821` files.
- Current diff scan: `76 / 100`, `0` errors, `1536` warnings, `35/64` files.

## Completed Changes

- [x] Removed the conditional hook path in `useLoginModal`.
- [x] Renamed local router `location` bindings to `routeLocation` where React Doctor misread them as mutable browser globals.
- [x] Added explicit cleanup for map, overlay, timeout, resize, and pointer listener effects.
- [x] Fixed date-only timezone drift for trip list markers and fake ticket previews.
- [x] Added stable keys and associated switch labels in core timeline/create-trip surfaces.
- [x] Added regression coverage for the login modal hook fallback.
- [x] Added repo guidance so future React feature work checks React Doctor and Vercel React best practices.
- [x] Hoisted default array props for timeline and season-strip components.
- [x] Replaced one immutable sort spread with `toSorted()`.
- [x] Cached month formatting work and replaced an index key in the ideal-travel timeline.

## Validation Log

- [x] `pnpm dlx react-doctor@latest . --verbose`
  - Result: `54 / 100`, `0` errors, `5745` warnings, `354/821` files.
  - Share: `https://www.react.doctor/share?p=travelflow&s=54&w=5745&f=354`

- [x] `pnpm dlx react-doctor@latest . --verbose --diff`
  - Result: `76 / 100`, `0` errors, `1536` warnings, `35/64` files.
  - Share: `https://www.react.doctor/share?p=travelflow&s=76&w=1536&f=35`

- [x] `pnpm test:run tests/browser/pricingPage.browser.test.ts tests/browser/admin/adminAirportsPage.browser.test.ts tests/browser/admin/adminUsersPage.softDeleteToast.browser.test.ts`
  - Result: passed, `29` tests.

- [x] `pnpm test:run tests/browser/tripManagerArchive.browser.test.ts tests/browser/admin/adminAirportsPage.browser.test.ts`
  - Result: passed, `16` tests.

- [x] Focused React Doctor regression suite
  - Command: `pnpm test:run tests/browser/navigation/accountMenu.browser.test.ts tests/browser/navigation/mobileMenu.browser.test.ts tests/browser/navigation/siteHeader.authHint.browser.test.ts tests/browser/navigation/siteHeader.localeSwitch.browser.test.ts tests/browser/tripview/TripFloatingMapPreview.browser.test.ts tests/browser/VerticalTimeline.browser.test.ts tests/browser/TimelineBlock.browser.test.ts tests/browser/useDbSync.browser.test.ts test/components/OnPageDebuggerMapRuntime.test.tsx test/browser/marketing/FaqPage.browser.test.tsx tests/browser/routes/tripLoaderRoute.browser.test.ts tests/browser/routes/sharedTripLoaderRoute.browser.test.ts tests/browser/routes/exampleTripLoaderRoute.browser.test.ts tests/browser/itineraryMapControls.browser.test.ts tests/unit/fakeAirportTicket.test.ts tests/unit/timelineListViewModel.test.ts`
  - Result: passed, `75` tests.

- [x] `pnpm build:netlify`
  - Result: passed through validators, sitemap generation, and Vite production build.
  - Notes: emitted existing CSS/view-transition, dynamic-import, and chunk-size warnings.

- [ ] `pnpm build`
  - Result: attempted twice, both stopped during `test:core` coverage before build steps.
  - First attempt: `tests/browser/tripManagerArchive.browser.test.ts` rendered empty state once, and `tests/browser/admin/adminAirportsPage.browser.test.ts` timed out once.
  - Second attempt: `tests/browser/pricingPage.browser.test.ts`, `tests/browser/admin/adminAirportsPage.browser.test.ts`, and `tests/browser/admin/adminUsersPage.softDeleteToast.browser.test.ts` failed under the full coverage run.
  - Follow-up: every failing file passed in isolation, so these are tracked as full-suite timing/state flakes rather than React Doctor remediation regressions.

## Prioritized Todo

### P0: Error Findings

- [x] `react-doctor/no-mutable-in-deps`
  - Status: fixed across the full scan.
  - Notes: changes are variable renames only, preserving router behavior.

- [x] `react-doctor/effect-needs-cleanup`
  - Status: fixed across the full scan.
  - Notes: cleanup paths now explicitly release timers, observers, overlays, and listeners.

### P1: Vercel Critical Performance Warnings

- [ ] `async-parallel`
  - Scope: independent async work in queue, worker, and sync services.
  - Approach: only parallelize calls with no ordering dependency, then add or run service tests.

- [ ] `async-defer-await`
  - Scope: effects and handlers that await before cheap guards.
  - Approach: move guards ahead of awaits where it does not change cancellation or race handling.

- [ ] `server-sequential-independent-await`
  - Scope: edge functions and tests with independent server awaits.
  - Approach: use `Promise.all` only when side effects do not rely on order.

### P2: Accessibility And Runtime Correctness

- [ ] Timeline clickable containers
  - Findings: `jsx-a11y/no-static-element-interactions`, `jsx-a11y/click-events-have-key-events`.
  - Approach: use semantic controls or keyboard-equivalent handling without disrupting drag/scroll behavior.

- [ ] Admin label associations
  - Findings: `jsx-a11y/label-has-associated-control`.
  - Approach: add `id`/`htmlFor` pairs or wrap labels around their controls.

- [ ] `react/no-unknown-property`
  - Scope: `PlaneWindowAnimation`.
  - Approach: use the React-supported `fetchPriority` prop.

### P3: Re-render And Effect Hygiene

- [ ] `rerender-memo-with-default-value`
  - Status: fixed for timeline/season-strip defaults in this PR; remaining occurrences should be checked in follow-up scans.

- [ ] `rerender-functional-setstate`
  - Scope: stale closure risks in add-activity and admin airport flows.
  - Approach: use functional state updates where the next value depends on the previous value.

- [ ] `prefer-use-sync-external-store`
  - Scope: auth/provider preference state synced from external stores.
  - Approach: only change when the store has a clear subscribe/getSnapshot API.

### P4: Broad Warning Backlog

- [ ] `design-no-default-tailwind-palette`
  - Count: roughly four thousand warnings.
  - Reason deferred: this is broad visual/design-token work and should be planned separately to avoid a large unintended redesign.

- [ ] `no-giant-component`, `prefer-useReducer`, `no-cascading-set-state`, `no-effect-chain`
  - Reason deferred: these are architectural refactors across large screens such as trip view, checkout, profile settings, and the debugger. They need focused tests and smaller PRs.

## Future Feature Gate

For React feature work:

- Run `pnpm dlx react-doctor@latest . --verbose --diff` before finalizing.
- Record the score in the PR validation notes when feasible.
- Consult `vercel-react-best-practices` for affected components, data fetching, and async work.
- Treat new React Doctor errors as fix-before-merge.
- Triage warnings by impact and avoid making the score worse without calling it out.
