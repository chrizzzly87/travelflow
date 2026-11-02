# Optional trip runtime: measured ownership split

[Raw samples, exact revisions, settings and graph evidence](trip-runtime.json).

## Compared revisions and method

- Before: `a9044b771e5692ed99fea7491de46685cce7b472`, the first-paint milestone merged by PR #563. Rebuilt in a separate clean checkout using the identical lockfile and candidate environment.
- After: `d89a5a37c9e301a78fbbf3fd879eb74cdd2d7cde`, [PR #567](https://github.com/chrizzzly87/travelflow/pull/567), tracked by [#566](https://github.com/chrizzzly87/travelflow/issues/566).
- Both reports record `sourceDirty: false`, Node 22.20.0, Chromium 145.0.7632.6 and identical framework versions/settings.
- Five fresh contexts per route plus one discarded warmup. Mobile 390 × 844, 4× CPU slowdown, 40 ms simulated latency, 500,000 bytes/s download, external network and service workers blocked. Candidate measured first; clean rebuilt baseline measured afterward. No concurrent builds, tests or browser audits during either reported measurement run.
- Initial predecessor samples overlapped validation work and are excluded from timing claims. The committed comparison uses the separate clean baseline.
- Readiness is the same existing route-specific marker in both runs: sealed public boot bridge, creation search/heading, or trip header menu. It does not measure completion of every map/network operation. JavaScript is collected through the subsequent 1.5 s settle window.
- Gzip values are standardized gzip estimates of fetched emitted JavaScript assets; they are not Netlify wire/Brotli measurements. This is a local built-server comparison, distinct from the hosted homepage Lighthouse report.

## Results

Medians, milliseconds; byte counts are gzip estimates.

| Route | Ready before | Ready after | Change | JS before | JS after |
| --- | ---: | ---: | ---: | ---: | ---: |
| Home | 1,721 | 1,731 | +0.6% | 368,638 | 369,890 |
| Features | 1,667 | 1,671 | +0.2% | 338,019 | 339,266 |
| Pricing | 1,455 | 1,444 | −0.8% | 356,618 | 357,861 |
| Classic creation | 2,482 | 2,477 | −0.2% | 516,181 | 517,939 |
| Wizard | 2,491 | 2,476 | −0.6% | 497,644 | 499,350 |
| Example trip | 3,495 | 2,975 | **−14.9%** | 786,633 | 708,434 |

The example transfers approximately **78 KB less gzip-estimated JavaScript (−9.94%)** in this window and reaches its marker about 520 ms earlier. Its LCP remains 760 ms and CLS stays zero. Public/creation readiness differences are below 1%; these do not establish a further improvement on those routes. Their JavaScript increases about 0.34–0.37% (1.2–1.8 KB), a small cost of the new routing/lifetime/recovery support. No across-the-board speedup is claimed.

These five-run lab medians are evidence for this build and method, not field Core Web Vitals, a statistical confidence interval or guaranteed timings for individual users.

## Why the graph changed

Ordinary viewing previously reached generation/destination authoring through direct abort, retry, queued claim execution and conflict-prefill construction. The latter was computed for every trip even when no conflict existed.

- Shared synchronous controller registry and pure capability policy now remain immediately available without importing generation execution.
- Retry and queue processing load for their permitted actions; committed trip/session lifetimes guard deferred continuations and results.
- Lightweight claim URL helpers are separate from destination normalization. Native trip `beforeLoad` prepares the optional recovery only for a real conflict marker.
- The recovery dialog owns full normalized creation links and uses shared focus handling, yielding to login and restoring focus after closing it.

An independent source AST regression prohibits static authoring edges from TripView and fails on the old viewer. Traversal of actual emitted static ESM edges finds the targeted AI/destination/alias/retry/queue/recovery chunks reachable before and **none reachable afterward**. The raw report records representative old paths and entry fingerprints. Vite dynamic preload maps are not counted as static execution edges.

The TripView entry itself remains large: approximately 161 KB gzip in both builds. This change removes optional dependencies from the ordinary viewing graph; it does not complete decomposition of the viewer. Continue measured domain/component extraction under [#561](https://github.com/chrizzzly87/travelflow/issues/561).

## Verification and preview

Preview: https://deploy-preview-567--travelflowapp.netlify.app/, deployed runtime `d89a5a37`, deploy `6ad5e3865b800a01d3abc62b`.

- Local: 502 core files, **2,932 tests passed**, one skipped; **72 Chromium/WebKit production checks**; three offline/PWA checks.
- Hosted: **72/72 checks passed**, including ordinary trip/details with optional authoring chunks blocked, complete creation links, actual login-modal focus handoff/return, and the existing appearance/consent/early-click/creation/trip matrix.
- Seven lifetime cases cover held work across trip/account changes, logout, unmount, return to a previous identity and StrictMode cleanup.
- TypeScript: 474 existing project diagnostics, zero new normalized diagnostics. React Doctor: 61/100, zero errors, eight reviewed existing warnings.
- No model/provider, credential, storage-key, persistence-schema or service-worker ownership changes. Exactly one release note remains draft. Main and production are unchanged.

Live OAuth/provider and authorized member/admin acceptance remain separate user preview checks. Local synthetic coverage is not proof of those external integrations. Remaining work includes native prerender output/canonical slash behavior, further Pricing/example profiling and the large viewer's internal ownership.
