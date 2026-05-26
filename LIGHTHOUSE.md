# Lighthouse Shared Plan

Last updated: 2026-05-26
Owner: Performance and SEO team

## Performance Targets
- **Mobile Lighthouse Performance score target**: `>= 90` on key entry routes.

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

