# First TanStack Start release

Status: the first native Start candidate is being finalized on
`codex/tanstack-start-release-hardening`, [PR #579](https://github.com/chrizzzly87/travelflow/pull/579).
Complete release review: [PR #574](https://github.com/chrizzzly87/travelflow/pull/574),
tracking [#559](https://github.com/chrizzzly87/travelflow/issues/559).
The current main changes through `229efdbdd` are integrated into the feature
candidate, including animated sharing previews; this task does not promote the
migration to main or production.

Local candidate acceptance (2026-10-22): **532 core files / 3,171 passing tests,
one skip; 94 Chromium/WebKit cases; five offline/PWA cases; 77 public documents**.
The previous intermittent React 18 selective-SSR errors are resolved by the native
Start client on React 19.3.1, Start 1.169.2 and Router 1.170.44. Browser error
assertions remain enabled. The initial dark theme meta is now owned by React after
the pre-paint script, avoiding duplicate metadata on navigation. Persian offline
chrome hydrates its immutable delivered locale before presenting the actual route.
Exact-head GitHub, hosted and live fixed-duration acceptance are recorded on PR #579;
do not infer those from the local result or an older preview.
React Doctor: **61/100, zero errors, ten warnings (maintainability and a browser-only date formatter)**. There are no
vendor patches, dependency-age bypasses or suppressed hydration errors.

## Required before the first release

- [ ] Fix neutral offline-shell contamination ([#575](https://github.com/chrizzzly87/travelflow/issues/575)) and validate cross-route offline metadata on the new deploy.
- [ ] Preserve zero-night return stops through generation mapping ([#576](https://github.com/chrizzzly87/travelflow/issues/576)); verify the actual requested period after a real round-trip generation on the fixed deploy.

- [x] Deploy the localized-banner fix and verify actual heading/action geometry in
  Chromium/WebKit, French and RTL, narrow widths, resize and dismissal.
- [x] Verify localized publication dates hydrate without text replacement under
  different browser language/timezone defaults (#573).
- [x] Pass local core/build/production-browser/offline gates: 513 files, 2,979
  passing tests, one skip; 94 Chromium/WebKit checks and three offline/PWA checks.
- [x] Verify all 94 browser checks on the actual hosted runtime `61bff8a7`, deploy
  `6ad70f862dd4fd8e39c054a0`, including French/RTL notice geometry, narrow/resized
  layouts, dismissal and mismatched browser language/timezone hydration.
- [x] GitHub PR Quality passes for runtime `61bff8a7` ([run 39382880993](https://github.com/chrizzzly87/travelflow/actions/runs/39382880993)).
  Every final PR head still requires successful GitHub checks before integration
  merge. PR #571 records the live check/merge state; documentation-only descendants
  reuse runtime acceptance only when their diff proves it contains no application,
  test, dependency or deployment changes.
- [x] Native flat documents: all 77 public locale/page combinations return HTTP 200
  with correct language, direction, canonical path and heading on hosted runtime
  `61bff8a7`, deploy `6ad70f862dd4fd8e39c054a0`; see
  [all 77 hosted results](performance/tanstack-start-2026-10-20/release-documents-hosted.json).
- [x] Publish the isolated native-document comparison with exact revisions and
  [raw samples/limitations](performance/tanstack-start-2026-10-20/public-documents.md).
  No minimum synthetic score or promised percentage is a release gate.
- [x] Existing authorized session restores and opens the real profile/trip library
  on hosted navigation runtime `52152903` (read-only browser check 2026-10-20).
- [x] The same authorized session opens the admin dashboard and its existing data
  on that runtime (read-only; no account/admin mutations).
- [x] Fresh Google sign-in on preview `22a203af` completes through the real provider
  and lands directly on the profile (2026-10-20, existing Google SSO, no credential
  copying and no persistent login selected). The member logo returns to the public
  homepage with My Trips. Shared modal cancellation has hosted regression coverage.
  This does not establish end-to-end acceptance of every other OAuth provider.
- [x] Facebook sign-in uses the existing provider grant (no expanded permissions),
  returns directly to the profile on preview #574/runtime `94ad1530`, and can see
  the same newly saved test trip. No credentials copied and persistent login off.
- [x] Record the remaining Kakao coverage explicitly: its Korean surface reaches
  the official provider login, but the final sign-in/callback is not live certified.
  Follow-up [#585](https://github.com/chrizzzly87/travelflow/issues/585). On 2026-10-20 the owner chose to keep this open and documented; no credentials
  were entered and the handoff tab was closed. This is an accepted coverage gap,
  not a passing-provider claim.
- [x] Owned trip opens through the real account; details load and title editing
  becomes available without changing the title. A full document reload restores
  trip access. Create Trip accepts a destination and retains its URL-prefilled
  selection across refresh; return navigation works (runtime `22a203af`, 2026-10-20).
  This initial check submitted no generation and changed no existing trip/admin data.
- [x] A subsequent real classic-generation smoke test on hosted runtime `61bff8a7`
  completed, saved a synthetic Japan trip, persisted a test title, reopened it from
  the profile and retained title/activities across a full document reload. Only
  this new test trip was edited. It exposed an extra return night (#576); this
  proves the live create/persist/reopen transport, not correct duration before the fix.
- [ ] Prepare final release metadata and production rollout/rollback record when a
  production promotion is actually approved. Keep the single migration release
  note draft until then; never invent a production publication timestamp.

## Already established

Native route ownership and URL/history/locale contracts, session-bound guard/cache
regressions, theme and initial cookie choices, direct guest Account sign-in,
public homepage for members, trip persistence contracts and offline behavior have
regression coverage and hosted acceptance. Architecture, contributor instructions,
Netlify operations and testing guides describe the native structure.

The full-project TypeScript backlog (#556) predates this migration. The previous React 18 candidate had 473 diagnostics. The React 19 candidate reduces
that backlog; exact counts and the normalized comparison are recorded on PR #579.
It remains visible debt; a successful Vite build does not mean a clean full-project typecheck.

## Follow-up, not a first-release requirement

Admin chart dependency modernization is [#584](https://github.com/chrizzzly87/travelflow/issues/584).
The actual bar/area/donut/list components pass an unmocked React 19 runtime test,
but Tremor still declares a React-18-only peer range. Keep that bounded evidence
separate from an upstream compatibility claim.

Further optional TripView decomposition, unused-JavaScript investigation and more
micro-optimizations stay under #561. Do not postpone a correct, verified first
release indefinitely to chase a perfect Lighthouse score. Preserve the recorded
benchmarks and choose subsequent changes from measured evidence.
