# React Doctor Remediation

Issue: #350
PR: #351
Branch: `codex/react-doctor-core-pages`

## Goal

Improve React Doctor health across the full repository while keeping this PR focused on findings surfaced by the scanner. The working target for this remediation is:

- Required: zero React Doctor error findings in the diff scan.
- Required: zero React Doctor error findings in the full scan.
- Target: keep the PR diff at or above `75 / 100` while moving the full repository score toward `60 / 100` without broad visual churn.
- Guardrail: only change files that React Doctor flagged or repo instructions require.

## Current Score Snapshot

Latest scanner used: `react-doctor v0.2.1`, resolved through `npx react-doctor@latest`.
React Review status: npm package `react-review@1.0.6` does not expose a CLI binary; React Doctor now points to React Review as the GitHub App for PR comments and score tracking.

- Initial user baseline: `49 / 100`, `73` errors, `5749` warnings, `356/814` files.
- After core-page fixes: `51 / 100`, `33` errors, `5752` warnings, `356/821` files.
- Current full scan: `68 / 100`, `0` errors, `847` warnings, `217/822` files.
- Current diff scan: `78 / 100`, `0` errors, `435` warnings, `73/165` files.

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
- [x] Removed derived reset effects from example-trip and profile-trip map image state.
- [x] Replaced share-link trip-id reset effects with active-trip derived state.
- [x] Replaced auth last-used-provider storage sync effects with `useSyncExternalStore`.
- [x] Fixed React DOM `fetchPriority` prop casing in the plane-window animation.
- [x] Added jsdom storage fallback setup so local browser tests can validate storage flows reliably.
- [x] Batched imperative DOM style writes in map/blog overlay code.
- [x] Collapsed React Doctor duplicate Tailwind size/padding classes in flagged files.
- [x] Applied the flagged heading-weight cleanup to scanner-reported heading tags.
- [x] Rewrote safe repeated array passes to single-pass loops/reducers, including a real `TripLoaderRoute` undefined-variable crash risk.
- [x] Consolidated safe route, auth, profile, blog, login, and trip preview state updates to reduce unnecessary rerenders and cascading effect state.
- [x] Kept `TripLoaderRoute` view/access state updates coherent while preserving in-session view override behavior.
- [x] Removed render-time date construction from flagged account, billing, trip-info, and print calendar JSX paths.
- [x] Replaced flagged fallback/loading copy punctuation and the blog table-of-contents anchor command.
- [x] Cleared the latest safe diff warnings for timeline keyboard semantics, handler-only drag state, one-sided alert accents, render-helper calls, listener resubscriptions, floating-map style allocation, intentional blog view-transition flushes, and reset-password form state.
- [x] Applied visual-equivalent Tailwind shorthand cleanup for repeated size/padding classes and softened flagged heading weights.
- [x] Cleared immutable-sort and min/max loop warnings in focused utility, admin, profile, storage, and export paths.

## Validation Log

- [x] `pnpm dlx react-doctor@latest . --verbose`
  - Result: `55 / 100`, `0` errors, `5737` warnings, `353/821` files.
  - Share: `https://www.react.doctor/share?p=travelflow&s=55&w=5737&f=353`

- [x] `pnpm dlx react-doctor@latest . --verbose --diff`
  - Result: `76 / 100`, `0` errors, `1613` warnings, `38/77` files.
  - Share: `https://www.react.doctor/share?p=travelflow&s=76&w=1613&f=38`

- [x] `pnpm test:run tests/browser/pricingPage.browser.test.ts tests/browser/admin/adminAirportsPage.browser.test.ts tests/browser/admin/adminUsersPage.softDeleteToast.browser.test.ts`
  - Result: passed, `29` tests.

- [x] `pnpm test:run tests/browser/tripManagerArchive.browser.test.ts tests/browser/admin/adminAirportsPage.browser.test.ts`
  - Result: passed, `16` tests.

- [x] Focused React Doctor regression suite
  - Command: `pnpm test:run tests/browser/navigation/accountMenu.browser.test.ts tests/browser/navigation/mobileMenu.browser.test.ts tests/browser/navigation/siteHeader.authHint.browser.test.ts tests/browser/navigation/siteHeader.localeSwitch.browser.test.ts tests/browser/tripview/TripFloatingMapPreview.browser.test.ts tests/browser/VerticalTimeline.browser.test.ts tests/browser/TimelineBlock.browser.test.ts tests/browser/useDbSync.browser.test.ts test/components/OnPageDebuggerMapRuntime.test.tsx test/browser/marketing/FaqPage.browser.test.tsx tests/browser/routes/tripLoaderRoute.browser.test.ts tests/browser/routes/sharedTripLoaderRoute.browser.test.ts tests/browser/routes/exampleTripLoaderRoute.browser.test.ts tests/browser/itineraryMapControls.browser.test.ts tests/unit/fakeAirportTicket.test.ts tests/unit/timelineListViewModel.test.ts`
  - Result: passed, `75` tests.

- [x] Focused effect/storage regression suite
  - Command: `pnpm test:run tests/browser/authUiPreferencesService.browser.test.ts tests/browser/authModal.browser.test.ts tests/browser/loginPage.browser.test.ts tests/browser/profileTripCard.browser.test.ts tests/browser/tripview/useTripShareLifecycle.browser.test.ts`
  - Result: passed, `26` tests.

- [x] `pnpm build:netlify`
  - Result: passed through validators, sitemap generation, and Vite production build.
  - Notes: emitted existing release-version validation warnings, CSS/view-transition, dynamic-import, and chunk-size warnings.

- [x] Focused render/copy regression suite
  - Command: `pnpm test:run tests/browser/navigation/accountMenu.browser.test.ts tests/browser/profileSettingsPage.browser.test.ts tests/browser/tripview/TripInfoModal.browser.test.ts tests/browser/checkoutPage.browser.test.ts tests/browser/itineraryMapControls.browser.test.ts tests/browser/routes/exampleTripLoaderRoute.browser.test.ts tests/browser/tripview/TripViewPlannerWorkspace.browser.test.ts tests/browser/TimelineBlock.browser.test.ts`
  - Result: passed, `66` tests.

- [x] `pnpm dlx react-doctor@latest . --verbose --diff`
  - Result: `87 / 100`, `0` errors, `153` warnings, `31/89` files.
  - Share: `https://www.react.doctor/share?p=travelflow&s=87&w=153&f=31`
  - Notes: latest package resolved to `react-doctor v0.2.1`; remaining warnings are mostly reducer/effect-chain/component-boundary work.

- [x] `pnpm test:core`
  - Result: passed, `304` test files, `1357` tests, `1` skipped.

- [x] `pnpm build:netlify`
  - Result: passed through validators, sitemap generation, and Vite production build.
  - Notes: emitted existing release-version validation warnings, CSS/view-transition, dynamic-import, and chunk-size warnings.

- [x] Focused state/effect regression suite
  - Command: `pnpm test:run tests/browser/authModal.browser.test.ts tests/browser/loginPage.browser.test.ts tests/browser/profileSettingsPage.browser.test.ts tests/browser/exampleTripCard.browser.test.ts tests/browser/createTripWizard.browser.test.ts tests/browser/createTripClassicLabPage.browser.test.ts tests/browser/routes/exampleTripLoaderRoute.browser.test.ts tests/browser/tripview/TripFloatingMapPreview.browser.test.ts tests/browser/TimelineBlock.browser.test.ts`
  - Result: passed, `56` tests.

- [x] Focused route-loader regression suite
  - Command: `pnpm test:run tests/browser/routes/tripLoaderRoute.browser.test.ts tests/browser/routes/exampleTripLoaderRoute.browser.test.ts tests/browser/tripview/TripFloatingMapPreview.browser.test.ts`
  - Result: passed, `33` tests.

- [x] `pnpm dlx react-doctor@latest . --verbose --diff`
  - Result: `85 / 100`, `0` errors, `170` warnings, `31/89` files.
  - Share: `https://www.react.doctor/share?p=travelflow&s=85&w=170&f=31`
  - Notes: latest package resolved to `react-doctor v0.2.1`; React Review remains a GitHub App integration rather than a local scanner CLI.

- [x] `pnpm test:core`
  - Result: passed, `304` test files, `1357` tests, `1` skipped.

- [x] `pnpm build:netlify`
  - Result: passed through validators, sitemap generation, and Vite production build.
  - Notes: emitted existing release-version validation warnings, CSS/view-transition, dynamic-import, and chunk-size warnings.

- [x] `pnpm test:core`
  - Result: passed, `301` test files, `1353` tests, `1` skipped.

- [x] `pnpm dlx react-doctor@latest . --verbose --diff`
  - Result: `84 / 100`, `0` errors, `185` warnings, `32/89` files.
  - Share: `https://www.react.doctor/share?p=travelflow&s=84&w=185&f=32`
  - Notes: latest package resolved to `react-doctor v0.2.1`; output advertises React Review as the GitHub App, not a local CLI.

- [x] `pnpm test:core`
  - Result: passed, `304` test files, `1357` tests, `1` skipped.

- [x] `pnpm build:netlify`
  - Result: passed through validators, sitemap generation, and Vite production build.
  - Notes: emitted existing release-version validation warnings, CSS/view-transition, dynamic-import, and chunk-size warnings.

- [x] Focused safe-warning regression suite
  - Command: `pnpm test:run tests/browser/VerticalTimeline.browser.test.ts tests/browser/TimelineBlock.browser.test.ts tests/browser/tripview/TripFloatingMapPreview.browser.test.ts test/components/OnPageDebuggerMapRuntime.test.tsx tests/browser/createTripClassicLabPage.browser.test.ts tests/browser/createTripWizard.browser.test.ts tests/browser/checkoutPage.browser.test.ts tests/browser/admin/AdminShell.storage.browser.test.ts tests/unit/blogViewTransitions.test.ts`
  - Result: passed, `64` tests.

- [x] `pnpm dlx react-doctor@latest . --verbose --diff`
  - Result: `91 / 100`, `0` errors, `121` warnings, `30/90` files.
  - Share: `https://www.react.doctor/share?p=travelflow&s=91&w=121&f=30`

- [x] Focused blog/example route regression suite
  - Command: `pnpm test:run tests/unit/blogViewTransitions.test.ts tests/browser/routes/exampleTripLoaderRoute.browser.test.ts`
  - Result: passed, `28` tests.

- [x] `pnpm dlx react-doctor@latest . --verbose --diff`
  - Result: `92 / 100`, `0` errors, `119` warnings, `30/91` files.
  - Share: `https://www.react.doctor/share?p=travelflow&s=92&w=119&f=30`
  - Notes: remaining diff warnings are architectural reducer/effect-chain/component-boundary work plus intentional async retry/view-transition patterns.

- [x] Focused auth UI regression suite
  - Command: `pnpm test:run tests/browser/loginPage.browser.test.ts tests/browser/authModal.browser.test.ts`
  - Result: passed, `14` tests.

- [x] `pnpm dlx react-doctor@latest . --verbose --diff`
  - Result: `92 / 100`, `0` errors, `118` warnings, `29/91` files.
  - Share: `https://www.react.doctor/share?p=travelflow&s=92&w=118&f=29`

- [x] `pnpm dlx react-doctor@latest . --verbose`
  - Result: `66 / 100`, `0` errors, `1029` warnings, `235/825` files.
  - Share: `https://www.react.doctor/share?p=travelflow&s=66&w=1029&f=235`

- [x] `git diff --check`
  - Result: passed.

- [x] `pnpm test:core`
  - Result: passed, `304` test files, `1357` tests, `1` skipped.

- [x] `pnpm build:netlify`
  - Result: passed through validators, sitemap generation, and Vite production build.
  - Notes: emitted existing release-version validation warnings, Node deprecation warnings, and Vite chunk-size warnings.

- [x] `pnpm dlx react-doctor@latest . --verbose --diff`
  - Result: `91 / 100`, `0` errors, `121` warnings, `30/90` files.
  - Share: `https://www.react.doctor/share?p=travelflow&s=91&w=121&f=30`

- [x] `pnpm test:core`
  - Result: passed, `1357` tests, `1` skipped.

- [x] `pnpm dlx react-doctor@latest . --verbose --diff`
  - Result: `92 / 100`, `0` errors, `118` warnings, `29/91` files.
  - Share: `https://www.react.doctor/share?p=travelflow&s=92&w=118&f=29`

- [x] `pnpm dlx react-doctor@latest . --verbose`
  - Result: `66 / 100`, `0` errors, `1027` warnings, `235/822` files.
  - Share: `https://www.react.doctor/share?p=travelflow&s=66&w=1027&f=235`

- [x] `pnpm updates:validate`
  - Result: passed with existing canonical-version warnings for older published update files.

- [x] `pnpm dlx react-doctor@latest . --verbose --diff`
  - Result: `77 / 100`, `0` errors, `444` warnings, `72/152` files.
  - Share: `https://www.react.doctor/share?p=travelflow&s=77&w=444&f=72`
  - Notes: this broad visual-equivalent full-scan cleanup improves the full backlog but expands the diff scan to more pre-existing warnings.

- [x] `pnpm dlx react-doctor@latest . --verbose`
  - Result: `66 / 100`, `0` errors, `881` warnings, `222/822` files.
  - Share: `https://www.react.doctor/share?p=travelflow&s=66&w=881&f=222`

- [x] `pnpm test:core`
  - Result: passed, `304` test files, `1357` tests, `1` skipped.

- [x] IDE lint diagnostics
  - Result: no linter errors found in edited `components/` and `pages/` files.

- [x] `npx react-doctor@latest . --verbose --diff`
  - Result: `78 / 100`, `0` errors, `435` warnings, `73/165` files.
  - Share: `https://www.react.doctor/share?p=travelflow&s=78&w=435&f=73`

- [x] `npx react-doctor@latest . --verbose`
  - Result: `68 / 100`, `0` errors, `847` warnings, `217/822` files.
  - Share: `https://www.react.doctor/share?p=travelflow&s=68&w=847&f=217`

- [x] Focused immutable-sort utility regression suite
  - Command: `pnpm test:run tests/unit/adminDashboardChartData.test.ts tests/unit/adminAiTelemetryChartData.test.ts tests/unit/cityRouteAndTransferLayout.test.ts tests/unit/tripCalendarExportService.test.ts tests/unit/profileTripState.test.ts tests/unit/offlineChangeQueue.test.ts tests/unit/destinationService.test.ts tests/unit/aiBenchmarkValidationInternals.test.ts tests/browser/storageService.browser.test.ts tests/browser/tripManagerArchive.browser.test.ts`
  - Result: passed, `66` tests.

- [x] IDE lint diagnostics
  - Result: no linter errors found in edited immutable-sort batch files.

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
  - Status: fixed for `TimelineBlock`; timeline scroll containers remain because they need a separate drag/scroll-safe interaction pass.
  - Approach: use semantic controls or keyboard-equivalent handling without disrupting drag/scroll behavior.

- [ ] Admin label associations
  - Findings: `jsx-a11y/label-has-associated-control`.
  - Approach: add `id`/`htmlFor` pairs or wrap labels around their controls.

- [ ] `react/no-unknown-property`
  - Scope: `PlaneWindowAnimation`.
  - Status: fixed with React-supported `fetchPriority` casing.

### P3: Re-render And Effect Hygiene

- [ ] `rerender-memo-with-default-value`
  - Status: fixed for timeline/season-strip defaults in this PR; remaining occurrences should be checked in follow-up scans.

- [ ] `rerender-functional-setstate`
  - Scope: stale closure risks in add-activity and admin airport flows.
  - Approach: use functional state updates where the next value depends on the previous value.

- [ ] `prefer-use-sync-external-store`
  - Scope: auth/provider preference state synced from external stores.
  - Status: fixed for auth/provider preference state; `ProfileStampsPage` trip storage remains.
  - Approach: only change remaining stores when they have a cached subscribe/getSnapshot API.

- [ ] `no-derived-state-effect`
  - Status: fixed for example-trip/profile-trip image state and share-link trip changes.
  - Remaining: `useTripOverlayController` route/mobile reset flow.
  - Approach: convert overlay modal/map expansion state to an explicit reducer or keyed child controller.

### P4: Broad Warning Backlog

- [ ] `design-no-default-tailwind-palette`
  - Count: roughly four thousand warnings.
  - Reason deferred: this is the main blocker for `>75 / 100` full-repo score, but a direct sweep touched 164 files, lowered the diff score, and barely moved the full score. Plan this as a dedicated design-token migration with visual review.

- [ ] `no-giant-component`, `prefer-useReducer`, `no-cascading-set-state`, `no-effect-chain`
  - Reason deferred: these are architectural refactors across large screens such as trip view, checkout, profile settings, and the debugger. They need focused tests and smaller PRs.

## Future Feature Gate

For React feature work:

- Run `pnpm dlx react-doctor@latest . --verbose --diff` before finalizing.
- Record the score in the PR validation notes when feasible.
- Consult `vercel-react-best-practices` for affected components, data fetching, and async work.
- Avoid new `useEffect` unless synchronizing with an external system; prefer render-time derivation, event handlers, `useMemo`, `useSyncExternalStore`, or `key`-based resets where they fit.
- Treat new React Doctor errors as fix-before-merge.
- Triage warnings by impact and avoid making the score worse without calling it out.
