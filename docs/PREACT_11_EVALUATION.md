# Preact 11 upgrade and first-load reliability

Date: 2026-10-13. Baseline: `4d3c93c38efaedb9bf6d533d7dcf8d8dd78c984c` (main).
Measured candidate: `140d53f40bd1d563e3a94a394a2b37f5784d704b` (clean checkout).
The candidate also contains the later main-only release timestamp correction
`30ff6b41`; no application behavior changed in that correction.

Tracking: [#554](https://github.com/chrizzzly87/travelflow/issues/554).

## Decision

Retain Preact and upgrade production from 10.29.2 to 11.0.1, with renderer 6.8.0
and Vite preset 2.10.6. Preserve the React 18.3.1 testing/type peer and explicit
ref wrappers. No broad component migration is necessary.

The measured improvement is reliable handling of early clicks. These application
fixes are required separately from the runtime upgrade: an event that occurs
before JavaScript loads cannot be handled by hydration changes alone.
Do not advertise a page-speed improvement from this upgrade. Current measurements
are effectively neutral, with roughly 0.4 KB additional gzip JavaScript per route
for the combined upgrade and first-interaction fix.

The earlier Preact migration was a defensible bundle-size experiment, but its
initial validation missed substantial prerender and Safari risks. The
[July postmortem](POSTMORTEM_2026-07_HOMEPAGE_PERFORMANCE_AND_HYDRATION.md)
documents that cost. Keeping Preact now is supported by the targeted production
regressions and small measured upgrade cost; it is not proof that Preact beats
React for this app. A React rollback should be a separately measured alternative
if hydration incidents continue. No new React-versus-Preact performance claim
is made by this two-version comparison.

## Compatibility review

The [official upgrade guide](https://preactjs.com/guide/v11/upgrade-guide/)
describes improved suspended-boundary hydration, automatic ref forwarding,
`Object.is` hook comparisons and deferred passive-effect cleanup. Its ESM and
TypeScript requirements fit this Vite/Node 22/TypeScript 5.8 app.
The app continues to import through compat, retaining numeric-style and
default-prop compatibility. Removed `SuspenseList`, `Component.base` and
direct legacy distribution imports are not used by application code.

[11.0.1](https://github.com/preactjs/preact/releases/tag/11.0.1) fixes suspended
hydration range ownership, ref cleanup ownership and unmounting parked Suspense
children. The lockfile selects that patch rather than 11.0.0. Its October 8
release was explicitly reviewed; only the installation command bypassed the
seven-day package age setting for `preact`. Repository-wide age protection is
unchanged, and frozen-lockfile installation is checked independently.

Existing safeguards remain necessary: matching initial markup, ready i18n,
static essential marketing content and a clean SPA fallback. Hydration 2.0
does not justify deleting them. Browser coverage exercises Radix Select,
dialogs, refs/focus, routing, i18n, trip editing and creation. Vitest retains
React 18, so production browser tests are the actual Preact compatibility gate.

## First-load defects and regression proof

Holding application JavaScript requests reproduces lost theme, FAQ and language
interactions on the original production build: all six cases failed (three
controls in Chromium and WebKit). After the fix each control waits for its own
owner to register readiness and receives one event through its normal handler.
The language selector replays pointerdown for Radix. Disabled/removed controls
are skipped, repeated early presses are coalesced, and readiness is reference
counted for overlapping mounts and deferred cleanup. There are no new storage keys.

The automated production suite covers seven English landing routes, cold German
and Persian/RTL landings, true mobile menu taps before hydration, classic and
wizard create-trip interactions, an example trip, and an encoded trip's mobile
menu/details/title edit. It rejects uncaught page errors and failed JS/CSS asset
responses. Existing offline/PWA tests remain in the same CI pipeline.

## Reproduction

Use Node 22 and the pinned pnpm version. Install Playwright Chromium and WebKit.
One command creates an isolated detached baseline, installs its frozen graph,
builds both versions, measures them sequentially and writes their comparison:

```sh
pnpm benchmark:runtime:upgrade --base=4d3c93c38efaedb9bf6d533d7dcf8d8dd78c984c
```

The temporary baseline is removed automatically. Results are written to
`perf/runtime/{before,after,comparison}.json`. Independent commands are available
as `benchmark:runtime --label=before`, `benchmark:runtime --label=after` and
`benchmark:runtime:compare`. The comparison rejects mismatched browsers, Node
versions, settings or route sets. Automated measurement is deliberately not a
noisy timing threshold in PR CI; the production functional tests are mandatory.

```sh
pnpm ci:local
PRODUCTION_BASE_URL=https://<verified-preview-host> pnpm test:e2e:production
```

The deployed command tests the real Netlify route handling and CDN. The local
server emulates clean SPA routing, gzip and local image transformations; it does
not emulate edge functions or the full Netlify platform.

## Measurement method and limits

Production builds; Chromium 145.0.7632.6; Node 22.20.0; 390 × 844 viewport;
4× CPU slowdown; 40 ms network latency; 500,000 bytes/s download. Each route gets
one discarded warmup and five fresh browser contexts, with service workers and
external network blocked. Values below are medians, not field percentiles.

“Ready” means the route's explicit readiness probe is present (marketing header
hydrated, creation input/wizard heading, or trip menu). It is not a measurement
of every possible interaction or complete API readiness. LCP and CLS observers
settle for 1.5 seconds after that probe. Blocking time is the sum of long-task
time above 50 ms in this observation window, **not Lighthouse TBT**. JavaScript
size sums distinct requested asset files with deterministic gzip; it is not
total page transfer. The upgrade and application fix are measured together.

Live AI generation, authenticated database writes, payment flows, third-party
map tiles and all supported physical devices are outside this deterministic
comparison. Existing service/unit coverage checks these integrations' contracts;
the local browser fixtures do not establish that every live backend is healthy.

## Verification

- Full local PR Quality stages: 2,828 tests passed in 475 files (one existing
  skipped test), validators and prerender/build; 36 Chromium/WebKit production
  checks and three offline/PWA checks passed. A wrong test button label was
  corrected and the browser/PWA stages were resumed successfully.
- The complete one-command benchmark ran successfully, including both frozen
  baseline installation and builds, all measurements, comparison and cleanup.
- All 36 cases also passed against the real [Netlify Deploy Preview for #557](https://deploy-preview-557--travelflowapp.netlify.app)
  at candidate `140d53f4`, covering deployed routing and assets in both engines.
- React Doctor changed-file scan: 100/100, no diagnostics.
- Full TypeScript check: 601 pre-existing diagnostics on both the clean Preact 10
  baseline and upgraded tree; no added normalized diagnostics. Type checking is
  not currently a clean CI gate and is tracked in [#556](https://github.com/chrizzzly87/travelflow/issues/556).
- No UI layout or direction-specific styling changed; cold RTL coverage checks
  the existing direction behavior. No product copy or locale keys changed.

## Measured results

| Route | Ready before → after (ms) | Change | LCP before → after (ms) | Observed blocking before → after (ms) | Gzip JS delta (bytes) |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` | 1990 → 1929 | -3.1% | 1864 → 1856 | 98 → 101 | +379 |
| `/features` | 1685 → 1696 | +0.7% | 812 → 812 | 50 → 52 | +347 |
| `/pricing` | 1265 → 1273 | +0.7% | 812 → 804 | 33 → 34 | +345 |
| `/create-trip` | 2196 → 2202 | +0.3% | 1864 → 1880 | 93 → 99 | +366 |
| `/create-trip/wizard` | 2827 → 2823 | -0.2% | 2452 → 2448 | 90 → 94 | +372 |
| `/example/thailand-islands` | 2808 → 2825 | +0.6% | 4016 → 4032 | 251 → 254 | +364 |

CLS is unchanged: 0.00585 for the three marketing routes and 0 for creation
and trip routes. Both runtime cohorts recorded zero uncaught page errors.
The small timing differences, including the homepage median reduction, do not
establish a meaningful speedup. An earlier independent five-run comparison
also found effectively neutral readiness (−1.3% to +1.7%).

Raw samples: [before](performance/preact11-before.json),
[after](performance/preact11-after.json). The automatic run used the same
measurement harness and settings for both builds and ran sequentially without
concurrent local browser tests.

The initial fetched JavaScript remains roughly 372–768 KB gzip depending on
route. Chunk loading and application work offer more performance opportunity
than the runtime version change demonstrated here. Further changes should get
their own measured baseline and production regression gate.
