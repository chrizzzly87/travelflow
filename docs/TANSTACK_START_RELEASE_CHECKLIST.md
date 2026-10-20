# First TanStack Start release

Status: candidate stabilization; no production promotion authorized. Main remains
unchanged. Tracking: [#559](https://github.com/chrizzzly87/travelflow/issues/559).
Current candidate: [PR #571](https://github.com/chrizzzly87/travelflow/pull/571),
including [banner regression #572](https://github.com/chrizzzly87/travelflow/issues/572)
and [public date hydration #573](https://github.com/chrizzzly87/travelflow/issues/573).

## Required before the first release

- [ ] Deploy the localized-banner fix and verify actual heading/action geometry in
  Chromium/WebKit, French and RTL, narrow widths, resize and dismissal.
- [ ] Verify localized publication dates hydrate without text replacement under
  different browser language/timezone defaults (#573).
- [ ] Pass final core/build/production-browser/offline gates and GitHub checks on
  the committed release candidate; verify the deployed commit, not just a URL.
- [x] Native flat documents: all 77 public locale/page combinations return HTTP 200
  with correct language, direction, canonical path and heading on hosted runtime
  `22a203af`, deploy `6ad6f4566bdac6dd07b3ca87`.
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
- [x] Owned trip opens through the real account; details load and title editing
  becomes available without changing the title. A full document reload restores
  trip access. Create Trip accepts a destination and retains its URL-prefilled
  selection across refresh; return navigation works (runtime `22a203af`, 2026-10-20).
  No real generation was submitted and no trip/admin data was changed. Deterministic
  generation/persistence contracts retain their separate regression coverage.
- [ ] Prepare final release metadata and production rollout/rollback record when a
  production promotion is actually approved. Keep the single migration release
  note draft until then; never invent a production publication timestamp.

## Already established

Native route ownership and URL/history/locale contracts, session-bound guard/cache
regressions, theme and initial cookie choices, direct guest Account sign-in,
public homepage for members, trip persistence contracts and offline behavior have
regression coverage and hosted acceptance. Architecture, contributor instructions,
Netlify operations and testing guides describe the native structure.

The full-project TypeScript backlog (#556) predates this migration. Current
navigation runtime has 473 diagnostics and zero new normalized diagnostics versus
its preceding baseline. It remains visible debt; a successful Vite build does not
mean a clean full-project typecheck.

## Follow-up, not a first-release requirement

Further optional TripView decomposition, unused-JavaScript investigation and more
micro-optimizations stay under #561. Do not postpone a correct, verified first
release indefinitely to chase a perfect Lighthouse score. Preserve the recorded
benchmarks and choose subsequent changes from measured evidence.
