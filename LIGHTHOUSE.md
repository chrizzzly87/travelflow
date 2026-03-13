# Lighthouse Shared Plan

Last updated: 2026-03-11
Owner: Codex automation (`lighthouse-test`)

## Threshold
- Mobile Lighthouse Performance score target: `>= 90` on key entry pages.

## Entry Page Status (latest recorded baselines in repo)
| Page | Route | Latest recorded score | Recorded at | Threshold status |
| --- | --- | --- | --- | --- |
| Homepage | `/` | `95` | 2026-02-21 (`docs/PERFORMANCE_EXECUTION_TODO.md`) | Pass |
| Create Trip | `/create-trip` | `92` | 2026-02-21 (`docs/PERFORMANCE_EXECUTION_TODO.md`) | Pass |
| Trip | `/trip/<compressed-state>` | `93` | 2026-02-21 (`docs/PERFORMANCE_EXECUTION_TODO.md`) | Pass |
| Example | `/example/thailand-islands` | `95` | 2026-02-21 (`docs/PERFORMANCE_EXECUTION_TODO.md`) | Pass |

## Run Notes (2026-03-11)
- Fresh Lighthouse runs are currently blocked in this sandbox:
  - `lighthouse` is not installed locally.
  - npm/pnpm install attempts fail with `ENOTFOUND registry.npmjs.org`.
- Automation fallback for this run: compare thresholds against latest committed baselines and ship a low-risk perf guard.

## Quick Wins Shipped This Run
- [x] Skip idle route warmups while first-load-critical suppression is active (`/`, `/create-trip`, `/trip`, `/example`) to avoid extra chunk fetches during first paint/Lighthouse window.
- [x] Added regression coverage to lock this behavior in `tests/browser/navigation/navigationPrefetchManager.browser.test.ts`.

## Next Todo
- [ ] Re-run fresh mobile Lighthouse once CLI/network is available for:
  - `/`
  - `/create-trip`
  - `/trip/<compressed-state>`
  - `/example/thailand-islands`
- [ ] Capture JSON reports under `tmp/perf/` with timestamped filenames.
- [ ] Update this table with fresh scores and add a short delta note versus 2026-02-21 baselines.
