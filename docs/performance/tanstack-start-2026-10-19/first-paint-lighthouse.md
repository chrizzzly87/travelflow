# Homepage: production versus native Start first-paint candidate

Measured 2026-10-19 with Lighthouse 13.5.0. [Compact measurements and settings](first-paint-lighthouse.json).

## Revisions and method

- Production: `ca90ba7bb7869265c5722c747356e889a0f6ee7e`, deploy `6acd95ed76aa8573702a1c04`, https://travelflowapp.netlify.app/.
- Candidate: `eaad9a0d12fb89744d0e6d8c7797ac8d91edf538`, deploy `6ad5d7797c0359b55af8c071`, https://deploy-preview-563--travelflowapp.netlify.app/.
- Three fresh-profile audits of each, sequentially interleaved production/candidate. Same machine and Chrome for Testing, mobile 412 × 823, default simulated mobile throttling (150 ms RTT, 1,638.4 Kbit/s throughput, 4× CPU slowdown). No parallel browser tests during measurement.
- New visitor with no pre-seeded consent decision. The candidate correctly shows its undecided banner immediately. No interaction, consent acceptance, storage warmup or animation disabling was used to improve scores.
- All six audits completed without runtime errors. Full local HTML/JSON reports: ignored `perf/runtime/homepage-lighthouse-2026-10-19/`.

## Results

Medians across three runs; seconds except total blocking time and layout shift.

| Measure | Current production | Candidate |
| --- | ---: | ---: |
| Performance score | 76 (75, 76, 78) | 88 (83, 90, 88) |
| Largest contentful paint | 4.67 s | 3.27 s |
| First contentful paint | 3.16 s | 2.78 s |
| Speed index | 3.47 s | 2.78 s |
| Total blocking time | 17 ms | 0 ms |
| Cumulative layout shift | 0.00118 | 0 |
| Accessibility | 100 | 100 |
| Best practices | 100 | 96 |
| SEO | 100 | 69 |

Largest contentful paint improved by approximately 30%. These are controlled lab observations, not field Core Web Vitals or a promise of identical scores for every visit. Production LCP ranged 4.53–4.84 s; candidate 3.04–3.88 s. Production and preview infrastructure differ, and this comparison includes the complete migration and first-paint changes; it cannot attribute the gain to the framework alone.

The preview SEO difference is the intentional `x-robots-tag: noindex` protection. The best-practices deduction is a cookie issue from Netlify's deploy-preview toolbar (`app.netlify.com/cdp/`). Do not remove preview indexing protection to raise an audit score. These deductions do not establish a product cookie-consent failure.

## Native responsive-image follow-up

Runtime `4809a7055d9cfb9894faa14dc10a7323b35e7145`, deploy `6ad5dd43df7f86948d11349e`, changes only native responsive-image selection and its regressions relative to the measured first-paint runtime. Three subsequent fresh-profile mobile audits used the same settings, after browser tests finished. They were not interleaved with production.

| Measure | First-paint candidate | Responsive-image follow-up |
| --- | ---: | ---: |
| Performance score | 88 (83, 90, 88) | 89 (89, 89, 87) |
| Largest contentful paint | 3.27 s | 3.26 s |
| Desktop artwork requests on mobile | 1 per run, approximately 83 KB | 0 in all three runs |
| Cumulative layout shift | 0 | 0 |

The dependable improvement is the eliminated hidden image transfer. The one-point score difference and near-identical LCP fall inside the observed run variation; no repeatable extra loading-time gain is established. Accessibility stays 100; preview best-practices/SEO remain 96/69 for the reasons above.

Both hosted Chromium and WebKit confirm no image request on mobile, then a visible loaded desktop frame after viewport resize while application scripts are held. This regression fails on the preceding hosted runtime and passes after the change. Final local gates: 492 core files, 2,894 passing tests, one skipped; 68 production browser checks; three offline/PWA checks. All 68 checks also pass on the exact hosted runtime.

## Remaining measured opportunities

The report also identifies approximately 62 KiB of unused initial JavaScript and a render-blocking stylesheet. Audit estimates are hypotheses for targeted bundle/style investigation, not additive measured savings. Continue under [#561](https://github.com/chrizzzly87/travelflow/issues/561); preserve first interactions, initial consent visibility and deterministic theme state.

## Functional evidence for the measured candidate

- 492 core test files; 2,893 tests passed, one skipped.
- 66 production browser checks passed locally **and on the exact hosted revision** in Chromium/WebKit, covering delayed scripts, first-frame appearance/consent, mobile account/language focus, native navigation, wizard and trip editing.
- Three offline/PWA checks passed locally.
- The first hosted attempt overlapped a confirmed local internet outage. The identical suite passed 66/66 after connectivity returned; no source, retry or wait changes were made to obtain the pass.
- Live OAuth/provider, authorized member/admin and paid-generation acceptance remain separate preview review items.

The earlier [72 → 88 report](../tanstack-start-2026-10-18/homepage-lighthouse.md) compared the foundation preview with an earlier follow-up. It is historical and uses a different baseline.
