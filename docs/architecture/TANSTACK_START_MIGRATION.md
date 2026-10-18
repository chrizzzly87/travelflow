# TanStack Start migration

Status: in progress, preview only. Decision date: 2026-10-18.
Integration branch: `codex/tanstack-start-integration`.
Baseline: `ca90ba7bb` (production Preact 11). Main is not a migration target until human preview acceptance.

## Progress dashboard — 2026-10-18

Tracking issue: [#559 — Migrate TravelFlow to TanStack Start on an isolated integration branch](https://github.com/chrizzzly87/travelflow/issues/559).
Implementation PR: [#560 — Migrate application foundation to native TanStack Start](https://github.com/chrizzzly87/travelflow/pull/560) (draft).
Implementation branch: `codex/tanstack-start-foundation`.
PR target: `codex/tanstack-start-integration`; never `main`.
Implementation commits: `f83b32bc` (native foundation), `b127e152` (hosted directory-path locale fix).
Verified preview: https://deploy-preview-560--travelflowapp.netlify.app, deployed revision `b127e152218ad2eb47e41e546c572842b1191dea`.
All 38 production browser checks also pass on the actual Netlify preview. Production is unchanged.
[Benchmark report and raw data](../performance/tanstack-start-2026-10-18/README.md).

| Workstream | Status | Evidence / next gate |
| --- | --- | --- |
| Baseline and acceptance criteria | Baseline captured | Five measured runs plus warmup against production baseline `ca90ba7bb`; equivalent after measurements pending. |
| Framework and native routing | Implemented and preview deployed | Native Start document, route layouts, loaders, intent preloading and Netlify adapter; production build prerenders eight documents. |
| Encapsulated application domains | Implemented and preview deployed | Shared shell, trip session, persistence, creation, view preferences, auth boundaries and admin route area separated. Local regression and hosted critical-flow checks pass; live account/provider acceptance remains. |
| Public rendering and first interaction | Targeted checks passing | SSR image mismatch and premature auth-context hydration update repaired. 38 production Chromium/WebKit checks pass, including delayed-JavaScript controls, localized/RTL entry, creation and encoded trips. The early Updates language-switch regression additionally passed 16 repeated checks. |
| Authentication and access | Regression coverage passing | Verified route guards, account/session races, inactive-account revocation and server-rendered auth-hint isolation covered. Live provider flows remain preview acceptance items. |
| Full regression suite | Last full fast stage passed | 481 files passed; 2,832 tests passed, one skipped. Coverage: statements 94.03%, branches 84.08%, functions 98.56%, lines 96.29%. |
| Production build | Passing locally | Latest build prerendered eight documents; service-worker generation succeeded. All 38 production browser and three offline/PWA checks pass, including restored iOS install metadata. |
| Active docs and release note | Updated | Architecture, deployment, testing, locale, contributor, agent and Lighthouse guidance updated; dated guidance archived. Exactly one release entry remains draft. |
| React/type diagnostics | Reviewed, limitations remain | React Doctor: 61/100, zero errors, ten warnings. Full-project TypeScript remains an existing tracked problem (#556); 493 full-project diagnostics remain, with zero in the new native/domain modules in the checked candidate. No clean full-project type check is claimed. |
| PR, integration merge and preview | Draft PR open | #560 targets integration and references #559. Both implementation commits are pushed. Actual preview revision and 38 hosted browser checks verified. Remote CI must pass before any integration merge. |
| Before/after benchmark | Measured and documented | Clean `b127e152` candidate versus production baseline, same five-run method. Readiness: home −7.5%, wizard −27.8%, pricing +18.0%, example +9.6%. Mixed result; see raw evidence and limits. |

### Architecture direction

Use native TanStack route layouts for public pages, auth/account, creation, trip workspace and admin. Routes own their loading, access checks and rendering boundaries. Public pages must not import the trip workspace or admin application graph through the shared shell. Keep trip session state scoped to trip identity and extract persistence, creation and view preferences into separate modules.

The initial approach of translating the legacy route registry into generated route copies has been discarded. A temporary navigation adapter supports existing callers during conversion; production route ownership and test history are native TanStack. Replace obsolete prefetch and prerender workarounds according to their purpose, preserving first-click handling, theme initialization and supported URLs where still needed.

Next milestone: finish remote CI and review the testable preview. Keep real OAuth/login/reset,
active member/admin actions and paid generation as explicit acceptance items; the automated
smoke checks do not certify those real-provider flows. Follow-up performance work should
profile pricing/example readiness regressions, route chunk boundaries and localized SSR
before changing code. The emitted home preload graph excludes trip workspace, persistence
and the full blog service. Integration merge is allowed after its gates; production promotion
remains a separate reviewed decision.

### Manual preview review

1. Open home/features/pricing on a cold mobile browser; immediately use menu, theme and language.
2. Open `/create-trip` and `/create-trip/wizard`, enter the intended trip details and confirm the flow.
3. Open `/example/thailand-islands`, then a real owned/shared trip; check edits, history, permissions and reload.
4. Sign in with a real account, check return destination, logout and password reset; use an authorized admin account to review admin routing.
5. Reopen a previously loaded/synced trip offline. No production schema change is part of this preview.


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
