# PR: Landing Page Speed & Font Loading Optimizations

This PR implements performance optimizations for TravelFlow's marketing and SEO landing pages, successfully improving Largest Contentful Paint (LCP) timings, font preloading behavior, and browser painting/layout overhead.

## Deployed Draft Preview
- **Netlify Draft Preview**: https://optimize-landing-pages--travelflowapp.netlify.app

---

## Key Performance Improvements

### 1. Cookie Consent Banner LCP Deferral
- **What**: Delayed mounting the global `CookieConsentBanner.tsx` by `4000ms` or until the first user interaction (scroll, mousemove, keydown, touchstart).
- **Why**: Prevented the banner from hijacking the initial LCP metric on page entries. LCP targets now correctly resolve to page-specific hero elements.

### 2. Language-Specific Dynamic Font Preloading
- **What**: Injected a dynamic `<script>` block in `<head>` of `index.html` to preload only the fonts matching the detected locale:
  - **Russian (`ru`)**: Preloads `noto-sans-cyrillic` and `noto-sans-cyrillic-ext`.
  - **Arabic/Persian/Urdu (`fa`/`ur`)**: Preloads Vazirmatn `400`, `700`, and `800`.
  - **Polish (`pl`)**: Preloads Bricolage and Space Grotesk basic Latin + Latin Extended subsets.
  - **Korean (`ko`)**: Preloads no web fonts (falls back to local system fonts).
  - **Other Latin locales**: Preloads basic Latin subsets only, avoiding the overhead of other script ranges.

### 3. Below-the-Fold Content Visibility & Intrinsic Sizing
- **What**: Added helper CSS classes in `index.css` applying `content-visibility: auto` and `contain-intrinsic-size` constraints.
- **Applied to**:
  - `FeatureShowcase.tsx` (`auto 1000px`)
  - `CtaBanner.tsx` (`auto 350px`)
  - `SiteFooter.tsx` (`auto 250px`)
- **Why**: Speeds up initial page paint by skipping layout and styling work for elements outside the viewport.

---

## 📈 Audit Metrics Comparison (Mobile)

We ran automated Lighthouse audits against local production preview builds:

| Page | Route | Performance Score | FCP | LCP | TBT | LCP Target Element |
| --- | --- | :---: | :---: | :---: | :---: | --- |
| **Homepage** | `/` | **84** | 1.1 s | 4.6 s | 0 ms | `div.min-h-screen > div.border-b > div.mx-auto > p.flex-1` (Header Banner) |
| **Features** | `/features` | **81** | 1.1 s | 5.0 s | 20 ms | `div.min-h-screen > div.border-b > div.mx-auto > p.flex-1` (Header Banner) |
| **Pricing** | `/pricing` | **83** | 1.1 s | 4.7 s | 30 ms | `main.mx-auto > div.py-8 > div.mx-auto > p.mt-4` (Subheader text) |
| **Blog** | `/blog` | **78** | 1.1 s | 5.9 s | 10 ms | `main.mx-auto > section.pt-8 > p.mt-5` (Intro text) |
| **Inspirations** | `/inspirations` | **78** | 1.1 s | 6.0 s | 10 ms | `main.mx-auto > section.pt-8 > p.mt-5` (Intro text) |

---

## Checklist
- [x] Pre-push verification (`pnpm run build` and `pnpm test:core`) completed.
- [x] Draft release note created and validated (`v0.116.0`).
