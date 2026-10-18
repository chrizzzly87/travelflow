# TanStack Start foundation: local comparison

## Revisions and method

Baseline application: `ca90ba7bb` (production). Its raw report records planning-only
commit `aec813be`, whose only change is the migration-plan document; application
code is identical to the production baseline. The preserved baseline build was
served from `/tmp/travelflow-preact11-baseline-ca90ba7bb`.

Candidate: `b127e152218ad2eb47e41e546c572842b1191dea`, clean committed source.
The candidate was built by the local CI build stage with its placeholder Supabase
configuration, as was the deterministic baseline measurement. No account or paid
provider flow is measured.

Both reports use Chromium 145.0.7632.6 and Node 22.20.0, a 390×844 viewport, 4× CPU
slowdown, 40 ms latency, 500,000 bytes/s download, blocked external networking and
service workers, five cold-context samples after one discarded warmup per route,
and 1,500 ms settling after each readiness probe. The comparator rejects different
browser, Node, route sets or settings.

Readiness means the existing boot bridge is sealed on marketing pages, the country
input/wizard heading is present on creation pages, or the trip menu is present on
an example. This is a reproducible route-specific probe, not a guarantee that every
control or background task is ready. JavaScript sizes sum distinct fetched assets
using local file sizes/gzip; they include speculative loads during the settling
window and are not exact transferred wire bytes. LCP is an early laboratory
observation, not field Core Web Vitals or INP.

## Medians

Lower times and fewer bytes are better. Times are milliseconds; gzip sizes are KiB.

| Route | Ready before → after | Change | LCP before → after | JS gzip before → after |
| --- | ---: | ---: | ---: | ---: |
| `/` | 1923 → 1778 | -7.5% | 1836 → 1008 | 363.5 → 348.8 |
| `/features` | 1680 → 1649 | -1.9% | 844 → 1028 | 746.0 → 319.2 |
| `/pricing` | 1249 → 1475 | +18.0% | 800 → 808 | 750.3 → 339.1 |
| `/create-trip` | 2185 → 2167 | -0.8% | 1840 → 2164 | 427.8 → 493.7 |
| `/create-trip/wizard` | 2804 → 2025 | -27.8% | 2424 → 2020 | 673.9 → 471.0 |
| `/example/thailand-islands` | 2747 → 3012 | +9.6% | 3936 → 4032 | 675.6 → 754.2 |

The result is mixed. Home and the creation wizard improve; pricing and the example
trip have readiness regressions. Features/pricing request much less JavaScript in
the observed window after removing the speculative route graph, while classic
creation and the example trip carry more runtime JavaScript. These measurements
do not support a claim that the framework migration makes every route faster.
Treat the regressions as remaining optimization work, independently of route and
hydration correctness.

## Functional evidence for this candidate

- 481 core test files; 2,832 passed tests, one skipped. Coverage: statements 94.03%,
  branches 84.08%, functions 98.56%, lines 96.29%.
- All local build/registry validators passed; eight native prerendered documents. Hosted directory-slash locale/namespace regression coverage is included.
- 38 production Chromium/WebKit checks passed, including cold locale/RTL entry,
  delayed-JavaScript first controls, both creation routes and encoded trip details.
- All 38 checks also pass on the actual Netlify preview at the measured revision.
  Dynamic German SSR returns route content, invalid locales return 404, and the
  existing location API returns JSON. Signed-out profile access preserves its
  return query/hash; `/admin` redirects through the existing dashboard entry to login.
- The previously failing early Updates language switch passed 16 repeated checks.
- Three PWA checks passed, including cold offline trip access and account API cache
  exclusion. The migrated document retains iOS installed-app metadata.
- React Doctor: 61/100 before/after, zero errors, ten scoped maintainability warnings
  after triage. Existing ignore configuration was renamed without broadening it.
- Full-project TypeScript remains tracked separately in issue #556; these functional
  results do not certify a clean full-project type check or live auth/provider flows.

## Raw evidence

[Before](before.json) · [After](after.json) · [Comparison](comparison.json)

Tracking: [issue #559](https://github.com/chrizzzly87/travelflow/issues/559),
[PR #560](https://github.com/chrizzzly87/travelflow/pull/560).
