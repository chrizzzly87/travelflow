# Hosted homepage Lighthouse — navigation/consent follow-up

Measured 2026-10-18 with Lighthouse **13.5.0**, headless Chrome for Testing
(Playwright Chromium 1208), default mobile simulation: 412 × 823 CSS pixels,
slow 4G (150 ms RTT, 1,638.4 Kbps), 4× CPU slowdown. Fresh browser profiles,
three runs per revision, no concurrent local browser/test workloads.

Before: [foundation preview #560](https://deploy-preview-560--travelflowapp.netlify.app/),
revision `363d233b` (same runtime as `b127e152`).
After: [follow-up preview #563](https://deploy-preview-563--travelflowapp.netlify.app/),
revision `3f8fa31c`. Verified Netlify deploy `6ad4ec69b56825e4edbb71cd` is ready
with that exact commit before the after runs. Subsequent commits add evidence and
replace the legacy analytics environment reader with direct Vite environment keys
so the consent regression tests also work without a local environment file. The
Lighthouse comparison is specifically for the measured runtime above; no separate
savings are attributed to that configuration cleanup.

| Mobile lab measurement | Before median | After median |
| --- | ---: | ---: |
| Performance | 72 (71–74) | 88 (88–89) |
| First contentful paint | 2.72 s | 2.72 s |
| Largest contentful paint | 7.10 s | 3.29 s |
| Speed index | 2.72 s | 2.92 s |
| Total blocking time | 3 ms | 0 ms |
| Cumulative layout shift | 0 | 0 |
| Accessibility | 100 | 100 |
| Best practices | 96 | 96 |
| SEO | 69 | 69 |

LCP decreased about **54%**; first paint is effectively unchanged and speed index
is slightly slower. This is a targeted improvement, not a claim that every metric
improved. The initial single baseline run scored 74; the three-run median is 72.
Component medians are independent, not one synthetic representative trace.

Essential hero text and its CTA no longer start invisible or move through a
staggered entrance. Lighthouse's LCP element changed from the late language
suggestion to the actual hero description. The useful language suggestion remains
present; neither it nor consent UI is hidden to influence the audit.
The fake pending navigation is replaced by real SSR-rendered navigation in the
initial module graph. Public routes no longer reload on auth-loading completion.
These changes were measured together, so individual causal savings are not claimed.

Remaining suggestions in the second after run: roughly 61 KiB unused JavaScript
and 330 ms render-blocking potential. These are estimates, not additive guaranteed
savings. Follow-up work belongs to #561 and should preserve first interactions.
The preview is intentionally excluded from search indexing; its SEO score does not
represent production indexing. These are lab measurements on Netlify previews,
not field Core Web Vitals or a guarantee for every device/network.

[Machine-readable per-run results and settings](./homepage-lighthouse.json).
Complete JSON/HTML reports are retained locally under the ignored
`perf/runtime/homepage-lighthouse-2026-10-18/` directory, with the original CLI
outputs in `/tmp/travelflow-home-lighthouse-*.report.*`.

## Reproduction

Set `CHROME_PATH` to the installed Chrome for Testing executable, then run each
URL three times sequentially with a different output path:

```sh
pnpm dlx lighthouse@13.5.0 "$AUDIT_URL" \
  --chrome-flags='--headless --disable-gpu' \
  --only-categories=performance,accessibility,best-practices,seo \
  --output=json --output=html --output-path="$REPORT_PATH" --quiet
```

Use the same machine/settings and keep other local browser workloads idle.
Do not substitute custom Playwright readiness measurements for Lighthouse.
