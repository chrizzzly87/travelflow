# Lighthouse Shared Plan

Last updated: 2026-07-03
Owner: Performance and SEO team

## Performance Targets
- **Mobile Lighthouse Performance score target**: `>= 90` on key entry routes.

---

## ⚠️ Prerender + hydration invariants (read before touching the boot path)

The marketing/landing pages are **prerendered static HTML** (`scripts/prerender-routes.mjs`)
that the client **hydrates in place**. This is fast but has sharp edges — the
following were each shipped as regressions and then fixed, so keep them intact:

1. **Hydrate immediately; never gate the mount.** `index.tsx` must call
   `hydrateRoot` right away. A previous "warm critical chunks before mounting"
   gate left prerendered pages visually complete but **non-interactive for up to
   ~5s on cold loads** (no nav highlight, banners, card-image upgrade, globe, or
   below-fold content until the gate elapsed). Hydration keeps the prerendered
   DOM on screen while it attaches and does **not** blank even while i18n
   namespaces are still loading (a suspending subtree retains its server DOM),
   so there is no reason to delay it. Warm route modules/i18n in the background
   instead.

2. **What is prerendered must equal the client's FIRST render**, or Preact-compat
   hydration rebuilds the subtree (flash + CLS). Consequences:
   - Below-fold `IntersectionObserver`-gated sections (`MarketingHomePage`,
     footer in `MarketingLayout`) stay **lazy on both** prerender and client —
     they start as empty spacers on each side and mount just after hydration.
     Do **not** force them eager: it regressed homepage LCP from ~3.9s to ~6.0s
     (score 86 → 73) for no real UX gain, since fast hydration already mounts
     them within a moment of load.
   - Image cards that swap to an icon/placeholder on error
     (`BlogPage`, `InspirationsPage`) render their `<picture>`+blurhash whenever
     `isPrerenderedDocument()` is true (see `services/prerenderHydrationState.ts`).
     That helper is true during capture (via a `__TF_PRERENDER_EAGER__` init
     flag) **and** on the client's first render (via the
     `data-tf-prerendered-root` attribute), so both agree and the image loads
     from the CDN on the live site instead of freezing as a fallback icon.

3. **Prerender must load images through the CDN endpoint.** The preview server
   does not implement `/.netlify/images`, so `prerender-routes.mjs` intercepts it
   with a `sharp` transform that honours `fm`/`w`/`q` (an AVIF `<source>` needs
   real AVIF bytes — serving webp-as-avif fails to decode → `onError` →
   fallbacks). Keep transforms modest; do **not** force-scroll every below-fold
   image into loading at once — the burst overwhelmed the transform and made
   error-fallback cards capture as fallbacks.

4. **Keep the boot-shell `<style>` in prerendered pages.** The runtime
   `AppBootstrapShell` (Suspense fallback during client-side navigation) reuses
   the inline `tf-boot-*` classes; stripping that style block caused a
   full-screen white flash on every page switch.

### Latest local audits (2026-07-03, `vite preview`; CDN images 404 locally so real LCP is better)
| Page | Score | FCP | LCP | TBT | CLS |
| --- | :---: | :---: | :---: | :---: | :---: |
| Homepage `/` | 86 | 2.1s | 3.9s | 20ms | 0 |
| Features | 84 | 2.3s | 4.2s | 10ms | 0 |
| Pricing | 85 | 2.3s | 4.1s | 0ms | 0 |
| Blog | 85 | 2.2s | 4.1s | 0ms | 0 |
| Inspirations | 76 | 2.6s | 5.6s | 20ms | 0 |

Remaining levers toward the ≥90 target: the header wordmark is still the
homepage LCP element (it repaints at hydration commit — inline it into the
initial header paint); Inspirations is image-heavy (24 cards) and needs an
above-the-fold image-priority pass; and the dormant critical-CSS inliner
(`TF_INLINE_CRITICAL_CSS=1`) still crashes and would cut ~0.7s off FCP.

---

## 📈 Entry Page Status (Baselines & Latest Audits)

Below are the latest recorded performance scores for primary entries and landing pages (Mobile audits):

| Page | Route | Performance Score | First Contentful Paint (FCP) | Largest Contentful Paint (LCP) | Total Blocking Time (TBT) | Cumulative Layout Shift (CLS) | LCP Target Element |
| --- | --- | :---: | :---: | :---: | :---: | :---: | --- |
| **Homepage** | `/` | **84** | 1.1 s | 4.6 s | 0 ms | 0 | `div.min-h-screen > div.border-b > div.mx-auto > p.flex-1` (Header Banners) |
| **Features** | `/features` | **81** | 1.1 s | 5.0 s | 20 ms | 0 | `div.min-h-screen > div.border-b > div.mx-auto > p.flex-1` (Header Banners) |
| **Pricing** | `/pricing` | **83** | 1.1 s | 4.7 s | 30 ms | 0 | `main.mx-auto > div.py-8 > div.mx-auto > p.mt-4` (Subheader text) |
| **Blog** | `/blog` | **78** | 1.1 s | 5.9 s | 10 ms | 0 | `main.mx-auto > section.pt-8 > p.mt-5` (Intro text) |
| **Inspirations** | `/inspirations` | **78** | 1.1 s | 6.0 s | 10 ms | 0 | `main.mx-auto > section.pt-8 > p.mt-5` (Intro text) |

*Note: FCP sits at 1.1s on mobile due to pre-rendered skeletons with inlined styles in `index.html`. LCP is now fully optimized with cookie consent deferral, fetch priority, and layout visibility containments.*

---

## 🚀 Running Automated Audits

We have created an automated Lighthouse runner script at `scripts/run-lighthouse-audits.mjs` to test pages locally.

### Steps to Run Audits:
1. **Build the production assets**:
   ```bash
   pnpm run build
   ```
2. **Start the local preview server**:
   ```bash
   pnpm exec vite preview --port 4173
   ```
3. **Run the automated audits** (in a separate terminal):
   ```bash
   PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node scripts/run-lighthouse-audits.mjs
   ```
   *(Note: Set the `PUPPETEER_EXECUTABLE_PATH` environment variable to point to your system's Google Chrome binary on macOS/Linux if local Chromium was not downloaded during installation).*

The script runs Lighthouse sequentially on all 5 landing pages, saves the JSON reports under `tmp/perf/`, and prints a Markdown summary table.

---

## ⚡ Performance Optimizations Applied

1. **Cookie Consent Deferral**: Delayed the mounting of `CookieConsentBanner.tsx` by `4000ms` or until first user interaction (scroll, mousemove, keydown, touchstart) using `useEffect` so it doesn't get picked up as the LCP element on page entries.
2. **Dynamic Language-Based Font Preloading**: Replaced static font preloads in `index.html` with an inline script block that detects active locale (via URL path or `localStorage`) and dynamically preloads only the font needed (e.g. Cyrillic Noto for `ru`, Cyrillic + Cyrillic Extended for Russian, Vazirmatn 400/700/800 for `fa`/`ur`, Latin + Latin-ext for Polish `pl`, and Latin-only subsets for default locales).
3. **Hero Image Fetch Priority**: Set `fetchPriority="high"` on the desktop above-the-fold airplane window image inside `PlaneWindowAnimation.tsx` and removed `loading="lazy"` to speed up hero image painting.
4. **Below-the-Fold Content Visibility**: Applied `content-visibility: auto` and `contain-intrinsic-size` constraints to complex sections (`FeatureShowcase.tsx`, `CtaBanner.tsx`, `SiteFooter.tsx`) to offload browser layout/rendering work until they scroll into view.

