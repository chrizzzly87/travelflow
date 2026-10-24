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
Runtime `e399ab1f` passed [GitHub Quality run 39743544622](https://github.com/chrizzzly87/travelflow/actions/runs/39743544622).
Ready immutable deploy: `6ad9c0a72a2e9ba6c92de714`; the branch alias also has an
equivalent ready deployment `6ad9c0a869c836e1f354c598`. All five hosted PWA checks
pass. All 94 hosted browser scenarios pass: the first run completed 93; the final
French article encountered a TCP-connect outage and passed its targeted recheck
after connectivity returned. No application error was ignored.

Real account acceptance on this runtime: a new synthetic Japan round trip,
2026-11-12 through 2026-11-21, generated Tokyo → Kyoto → Tokyo with exactly
10 days / 9 nights. The initial network-interrupted enqueue failed visibly;
Retry generation succeeded in 19.8 seconds using the default GPT-5.4 model.
Rename, saved profile card, reopen and full reload preserve title, dates and
activities. No existing trip or admin record was changed. The real admin overview
and data-backed charts also render. This verifies that particular generation,
not arbitrary model output meeting every requested budget.

The following documentation-only commit records that accepted runtime; verify
its diff before reusing runtime evidence and require green exact-head GitHub checks.
React Doctor: **61/100, zero errors, ten warnings (maintainability and a browser-only date formatter)**. There are no
vendor patches, dependency-age bypasses or suppressed hydration errors.

## Required before the first release

- [x] Fix neutral offline-shell contamination ([#575](https://github.com/chrizzzly87/travelflow/issues/575)) and validate cross-route offline metadata on the new deploy.
- [x] Preserve zero-night return stops through generation mapping ([#576](https://github.com/chrizzzly87/travelflow/issues/576)); verify the actual requested period after a real round-trip generation on the fixed deploy.

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

The full-project TypeScript backlog (#556) predates this migration. The previous React 18 candidate had 473 diagnostics. The accepted React 19 runtime has 351 diagnostics and zero new normalized
file/error-code diagnostics against that baseline, recorded on PR #579.
It is now cleared (#556): `pnpm typecheck` (`tsc --noEmit -p .`) reports zero errors on PR
#591 and runs as a PR Quality step and a `ci:local` stage. Fixing the types surfaced and
fixed real defects with regression tests (an undeclared storage-key constant in the admin
shell, an undeclared title in prompt dialogs, a profile section crashing on updates
without messages, a partial AI runtime settings draft, admin airport sync toasts that
vanished mid-run, and two queued-generation payload casts).

## Follow-up, not a first-release requirement

Admin chart dependency modernization ([#584](https://github.com/chrizzzly87/travelflow/issues/584))
replaced Tremor with shared `recharts` 3.10.1 components in `components/admin/charts`,
whose peer ranges include React 19; Tremor and its unused date-picker and headless-UI
dependencies are gone from the lockfile. Component tests cover data, empty states,
theme tokens, keyboard tooltips and list selection in jsdom. Still to verify on a
hosted preview with an admin session: the dashboard, billing and AI telemetry charts
with real data, pointer tooltips, resize behaviour and the visual match in light and
dark mode.

Route-search ownership (#586) is fixed on PR #591: pages read search from their own
route match and see the committed URL while a navigation is pending, so a page being
left can no longer write its query onto the next one. Explicit versions, shares and
prefills are unchanged; hover preloads now parse the real query.

PR #591 hosted acceptance (deploy preview, commit `cf6e2dd5`): two consecutive full runs
of the production browser suite passed **94/94** each on Chromium and WebKit. Netlify
reports public documents stored in its durable CDN cache (`cache-status: "Netlify
Durable"; stored`), session documents (`/profile`, `/s/…`) bypassing it, retired planner
URLs answering 301 with their query string, and `/admin` staying a 307.

Further optional TripView decomposition, unused-JavaScript investigation and more
micro-optimizations stay under #561. Do not postpone a correct, verified first
release indefinitely to chase a perfect Lighthouse score. Preserve the recorded
benchmarks and choose subsequent changes from measured evidence.
