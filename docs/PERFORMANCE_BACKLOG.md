# Performance Backlog

This backlog stays open as a continuous performance track across routes.

## Baseline Workflow
- Run Lighthouse on target route in production mode (`npx vite build && npx vite preview`).
- Record FCP, LCP, TBT, CLS, Speed Index and top blocking requests.
- Apply one scoped improvement, rerun Lighthouse, and keep the best variant.

## Navigation Prewarm Guardrails (Current Default)
- Keep route/module warmup **non-blocking**. Prewarm calls should be fire-and-forget (`void preloadRouteForPath(...)`), never awaited before navigation.
- Keep click navigation direct. Do not wrap global route clicks with `document.startViewTransition(...)` while speed work is active.
- Current prewarm behavior:
  - `App.tsx` prewarms route chunks on link intent (`mouseover`, `focusin`, `touchstart`).
  - `App.tsx` prewarms select marketing routes in dev only (`IS_DEV` delayed warmup).
  - `components/marketing/ExampleTripsCarousel.tsx` prewarms `TripView` chunk for example-card flows.
- `viewTransitionName` attributes and `::view-transition-*` CSS may remain in code; they are inert unless a `startViewTransition` call executes.
- When testing any transition reintroduction, gate it behind a reversible flag and validate both directions:
  - homepage -> example trip
  - browser back example trip -> homepage
- Reject any change that regresses navigation responsiveness, adds blocking waits, or increases route fallback flashes.

## Active Work Items
- [x] Remove globally loaded Leaflet assets from `index.html`.
- [x] Split app routes with `React.lazy` + `Suspense` so blog routes avoid planner bundles.
- [x] Raise blog image cache TTL on Netlify.
- [x] Recompress existing blog images with stricter WebP quality presets.
- [x] Add manual Vite chunks for large shared dependencies to reduce the largest vendor chunk.
- [x] Self-host `Space Grotesk` to remove Google Fonts request chain entirely.
- [x] Add a self-hosted `Bricolage Grotesque` heading preview variant to compare visual style without CDN font requests.
- [x] Add self-hosted global fallback subsets (`Noto` script ranges) for international place names outside Latin scripts.
- [x] Ensure OG image edge functions load local self-hosted fonts first (with fallback) so social image generation does not depend on third-party font CDNs.
- [x] Use pre-generated homepage example map images instead of runtime `/api/trip-map-preview` requests to avoid extra request chains and preview failures.
- [x] Add static-map satellite fallback (`satellite` → `clean`) in preview/OG pipelines where satellite/hybrid static map types are unavailable.
- [x] Preload high-traffic lazy route modules on link intent and dev warmup so first local navigation no longer flashes route fallback while chunks compile.
- [x] Defer `OnPageDebugger` loading unless explicitly enabled.
- [x] Document navigation prewarm and transition guardrails to keep future speed optimizations from reintroducing blocking route transitions.
- [ ] Repeat route-by-route Lighthouse sweeps (`/`, `/blog`, `/blog/:slug`, `/inspirations`, `/pricing`, `/create-trip`, `/trip/:id`).
