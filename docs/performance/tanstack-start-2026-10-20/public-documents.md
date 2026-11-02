# Native public document delivery

Measured 2026-10-20. [Raw samples](public-documents.json); [77 hosted document checks](public-documents-hosted.json).

## Revisions and method

- Baseline: navigation runtime `52152903`, immutable deploy `6ad6f2274ccbfc91e3f6c880`.
- Candidate: native flat prerender runtime `22a203af`, immutable deploy `6ad6f4566bdac6dd07b3ca87`.
- Five sequential samples of each revision for each of five paths (50 compressed document GETs). Alternate revision order each round, follow redirects, use a fresh curl process per request. No concurrent automated browser tests or local build during measurement.
- These are document requests without browser assets, CPU/network throttling or a Lighthouse run. CDN caches were not cleared; preceding acceptance probes warmed some paths. No forced cold-function state or server trace was obtained.
- The later localized-banner/date stabilization changes are outside this isolated comparison. This report makes no new claim about their performance.

## Results

Medians; curl first-byte and complete-transfer timings in milliseconds. All final responses were HTTP 200.

| Path | Redirects before → after | First byte before → after | Complete transfer before → after |
| --- | ---: | ---: | ---: |
| `/` | 0 → 0 | 278 → 434 | 665 → 555 |
| `/features` | 1 → 0 | 475 → 331 | 502 → 346 |
| `/pricing` | 1 → 0 | 296 → 277 | 385 → 292 |
| `/de/pricing` | 0 → 0 | 580 → 298 | 604 → 327 |
| `/fa/pricing` | 0 → 0 | 466 → 167 | 493 → 190 |

The dependable structural result is the removed redirect on the English entry paths and ready public documents for every active locale. All 77 hosted locale/page combinations returned HTTP 200 directly, with expected language, direction, canonical path and heading, including localized roots that coexist with child directories.

Localized pricing complete-transfer medians improved in this sample. The first baseline German pricing request took **15.11 seconds**; subsequent requests were much faster. Its cause was not traced, so it must not be labeled a proven cold start. The candidate had no comparable spike in these samples.

The homepage first-byte median became **worse** (278 → 434 ms), while its complete-transfer median improved (665 → 555 ms). Five samples and uncontrolled remote cache/network conditions do not establish a repeatable homepage gain or a universal speedup. Per-route medians cannot be added together or substituted for field Core Web Vitals.

## Compatibility and scope

The build validates the actual 77 flat documents and separate offline shell, rejecting missing/localization/canonical errors and competing directory indexes. The service-worker precache stays 45 files / approximately 1.3 MB; users do not download all public documents for offline use.

Native SSR remains available for other public routes; selective client rendering and guards remain for account/trip/admin areas. No blanket SPA rewrite, auth authority, storage keys or backend contracts changed. Local acceptance on the prerender runtime passed 512 core files / 2,973 tests (one skip), 84 browser checks and three PWA checks.

The subsequent first-release stabilization adds localized-banner geometry and public date-hydration regressions. Its full local gate passes **513 files / 2,979 tests (one skip), 94 Chromium/WebKit checks and three PWA checks**. Its exact hosted acceptance is recorded on PR #571; those runtime changes are not silently attributed to the document-only measurements above.
