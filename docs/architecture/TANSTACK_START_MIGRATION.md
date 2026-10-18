# TanStack Start migration

Status: in progress, preview only. Decision date: 2026-10-18.
Integration branch: `codex/tanstack-start-integration`.
Baseline: `ca90ba7bb` (production Preact 11). Main is not a migration target until human preview acceptance.

## Goal and decisions

Move TravelFlow to TanStack Start and TanStack Router on the supported React runtime, preserving URLs, locales, accessibility, analytics, authentication and trip persistence. Retain the existing Netlify API/edge contracts; a framework migration does not justify rewriting working business logic or moving credentials into browser code.

Use the official Start Vite integration and Netlify adapter. Remove production Preact aliases. Route ownership belongs to TanStack, with a small explicitly temporary navigation API adapter for existing components, not two competing browser routers. New routes use native TanStack APIs. Keep the existing supported React major initially; evaluate React upgrades separately from routing regressions.

SSR must be deterministic and request isolated. Public pages are candidates for SSR/prerender; account-sensitive planner and admin surfaces may use selective client rendering. Never render personalized responses into shared static HTML. Preserve essential static content and first-click behavior. Do not suppress hydration errors to claim success.

## Delivery sequence

1. Record architecture, source inventory, baseline measurements and acceptance criteria. Create a tracking issue. Push an integration branch based on production, then develop on a child branch with PRs targeting integration only.
2. Install a compatible pinned Start/Router/Vite/Netlify graph. Replace document entry and browser routing. Preserve route parameters, query strings, history state, replace/back/forward, nested admin navigation and not-found behavior. Add regression tests for the migration adapter and route inventory.
3. Establish deterministic public rendering and client-only boundaries for browser-dependent tooling. Replace obsolete browser-capture/preload assumptions with framework build conventions. Defer full trip editor imports in the creation wizard and reduce speculative planner loading where measured.
4. Update active architecture, contributor, deployment, testing and agent guidance. Preserve dated postmortems as historical evidence with migration pointers. Maintain one draft release entry; do not mark a feature-branch preview as production published.
5. Run core regression coverage, framework build, targeted TypeScript checks, React Doctor, Chromium/WebKit first-load and critical route checks, existing offline tests, and equivalent before/after benchmarks. Deploy a preview on the verified repository-specific Netlify project. Merge validated child PRs into integration, never main. Provide preview URL, exact revision, evidence, known limits and a manual review checklist.

## Acceptance matrix

- Public: home, features, pricing, FAQ, updates, blog/detail, inspirations/detail and legal pages; locale prefixes including RTL; canonical/OG metadata; header/footer and responsive navigation.
- Interaction: clicks before hydration, theme, language, FAQ, mobile menu, keyboard/focus and dialog portals.
- Planning: classic and wizard destination/date flows, example and encoded trip loading, details/title editing, history navigation and persistence contract tests.
- Accounts/admin: login return paths/search/hash, authorization guards and nested routing. No real purchases, destructive admin mutations or paid AI generation are required for deterministic smoke tests.
- Platform: existing API/edge endpoints, server-only credentials, asset 404s, clean production shell, service-worker update/offline behavior.
- Performance: same browser, network/CPU profile, viewport and probes as baseline. Separate transferred JavaScript from speculative warmup and runtime readiness; publish measured results, not assumed framework gains.

## Merge and rollback

The integration branch is the rollback boundary. Each meaningful commit describes its purpose. Child PRs name the integration base explicitly. Production main remains untouched. Existing backend/schema contracts remain compatible so preview rollback is a code/deploy operation, not a database migration. Production promotion needs a separate reviewed decision after preview acceptance.

## References reviewed

- https://tanstack.com/start/latest/docs/framework/react/build-from-scratch
- https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr
- https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering
- https://docs.netlify.com/build/frameworks/framework-setup-guides/tanstack-start/

Registry inspection on 2026-10-18: current Start requires Node >=22.12 and Vite >=8; do not copy older Vinxi/Nitro setup instructions into this migration. The exact installed graph and evidence will be recorded below as implementation progresses.
