# Landing-page performance

## Targets and evidence

Target mobile Lighthouse Performance >= 90 on key entry routes. A target is not
proof of a passing audit. Keep the measurement revision, browser, throttle, image
handling and raw results with each report. Historical July 2026 Lighthouse results
and the retired runtime guidance are archived in
[the dated report](docs/performance/lighthouse-2026-07-03.md).

## Current TanStack Start principles

- Native Start SSR and configured prerendering own documents. There is no browser
  capture script or second SPA document router.
- Hydrate through the native Start client. Preload only the active route's locale
  namespaces; do not wait for every route or preload the trip editor before attaching
  public-page handlers.
- Render meaningful landing-page content on the server. Keep the server and first
  browser render deterministic, including image placeholders and auth hints.
  Do not use empty spacers, browser-capture flags or idle callbacks to conceal
  hydration mismatches.
- Keep the lightweight public preview data independent of full editable trips.
  Split loaders and pending components explicitly, then inspect emitted preloads
  and real network requests to prove that unrelated domains stay unloaded.
- Keep one shared atomic Tailwind stylesheet to preserve responsive utility order.
  Load feature-specific map/widget styles with their feature.
- Apply theme before paint using `src/document/theme-boot.js`, with the same storage
  contract as `contexts/theme/themeStore.ts`. Loading-shell styles live in cached CSS.
- Test early controls with JavaScript delayed. Include Chromium and WebKit and treat
  recoverable hydration errors as failures. The initial browser auth-context update
  must not interrupt a still-hydrating Suspense boundary.

## Reproducible checks

Run `pnpm ci:local` for validators, core coverage, the production build, both browser
engines and offline checks. `pnpm benchmark:runtime` measures six fixed routes with
five cold samples plus warmup under a fixed browser/CPU/network profile. Compare
matching reports with `pnpm benchmark:runtime:compare`; do not infer production
field performance or INP from this local readiness probe.

Use `scripts/serve-built-site.mjs` for the built local browser harness: it serves
native dynamic routes and emulates same-origin image transforms. Validate the
actual Netlify preview separately because this harness does not execute every
hosted Edge Function.

See [architecture](docs/TANSTACK_START_ARCHITECTURE.md),
[deployment](docs/NETLIFY_TANSTACK_START.md) and
[acceptance plan](docs/architecture/TANSTACK_START_MIGRATION.md).
