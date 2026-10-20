# TanStack Start migration

Status: in progress, preview only. Decision date: 2026-10-18.
Integration branch: `codex/tanstack-start-integration`.
Baseline: `ca90ba7bb` (production Preact 11). Main is not a migration target until human preview acceptance.

## Current stabilization round — 2026-10-19

PR [#563](https://github.com/chrizzzly87/travelflow/pull/563) passed final remote CI and merged into
`codex/tanstack-start-integration` as `12222d714` on 2026-10-19. Production is unchanged. Hosted failures are
tracked in [#564](https://github.com/chrizzzly87/travelflow/issues/564). Their causes
are now reproduced: first anonymous-session creation re-entered account loading
and discarded the active workspace; a translation module rejection occurred before
any router/React error boundary existed. The local fixes preserve the guest workspace
and transport request-owned translation resources through native router hydration.
Saved unprefixed-workspace language is restored after the delivered document hydrates.
The first-paint candidate passes 492 core files / 2,894 tests (one skipped), 68 production browser
checks and three offline/PWA checks locally. The hosted trip-dialog fix at `f16942d6` additionally passed 12 independent delayed-asset mobile repetitions, including title editing, without dialog dismissal or page errors.

The new first-visible-frame requirements are tracked in
[#565](https://github.com/chrizzzly87/travelflow/issues/565): immediately visible
undecided consent, coherent theme state and stable account entry without optimistic
auth authority. Implementation and combined local gates now pass: stored/system theme at first paint and across navigation, pre-hydration consent choices, permanent account entry, immediately complete verified-member actions from the common namespace, mobile account/language focus and safe login return URLs. Hosted revision `eaad9a0d` now passes all 66 Chromium/WebKit checks. Three interleaved mobile Lighthouse runs per revision show median performance **76 → 88** and LCP **4.67 → 3.27 s** against actual current production; [settings and limits](../performance/tanstack-start-2026-10-19/first-paint-lighthouse.md). The subsequent native responsive-image revision `4809a705` passes all 68 hosted browser checks; three separate follow-up Lighthouse runs show median 89, LCP 3.26 s and zero mobile frame requests. The eliminated approximately 83 KB transfer is verified; the one-point score change is within observed variation. README now links the architecture, routing, feature ownership,
testing and deployment entry points.

## Progress dashboard — 2026-10-19

Tracking issue: [#559 — Migrate TravelFlow to TanStack Start on an isolated integration branch](https://github.com/chrizzzly87/travelflow/issues/559).
Implementation PR: [#560 — Migrate application foundation to native TanStack Start](https://github.com/chrizzzly87/travelflow/pull/560) (merged into integration on 2026-10-18).
Implementation branch: `codex/tanstack-start-foundation`.
Current follow-up: [PR #563 — Stabilize first-paint theme, consent, account navigation and hydration](https://github.com/chrizzzly87/travelflow/pull/563), branch `codex/tanstack-start-performance`, closes [#562](https://github.com/chrizzzly87/travelflow/issues/562).
Follow-up preview: https://deploy-preview-563--travelflowapp.netlify.app, last verified hosted runtime `4809a705` (68/68 Chromium/WebKit checks).
PR target: `codex/tanstack-start-integration`; never `main`.
Implementation commits: `f83b32bc` (native foundation), `b127e152` (hosted directory-path locale fix).
Verified preview: https://deploy-preview-560--travelflowapp.netlify.app, deployed revision `b127e152218ad2eb47e41e546c572842b1191dea`.
All 38 production browser checks also pass on the actual Netlify preview. Production is unchanged.
[Benchmark report and raw data](../performance/tanstack-start-2026-10-18/README.md).
[Hosted homepage Lighthouse follow-up](../performance/tanstack-start-2026-10-18/homepage-lighthouse.md): three-run mobile median performance **72 → 88**, LCP **7.10 → 3.29 s**, CLS zero. This compares foundation to follow-up; the production baseline comparison is separate.

| Workstream | Status | Evidence / next gate |
| --- | --- | --- |
| Baseline and acceptance criteria | Before/after captured | Five measured runs plus warmup against production baseline `ca90ba7bb` and the foundation candidate; mixed results documented below. |
| Framework and native routing | Implemented and preview deployed | Native Start document, route layouts, loaders, intent preloading and Netlify adapter; production build prerenders eight documents. |
| Encapsulated application domains | Implemented and preview deployed | Shared shell, trip session, persistence, creation, view preferences, auth boundaries and admin route area separated. Local regression and hosted critical-flow checks pass; live account/provider acceptance remains. |
| Public rendering and first interaction | Targeted checks passing | SSR image mismatch and premature auth-context hydration update repaired. 68 production Chromium/WebKit checks pass locally, including delayed-JavaScript controls, first-frame theme/consent/account states, localized/RTL entry, creation and encoded trips. The early Updates language-switch regression additionally passed 16 repeated checks. |
| Authentication and access | Regression coverage passing | Verified route guards, account/session races, inactive-account revocation and server-rendered auth-hint isolation covered. Live provider flows remain preview acceptance items. |
| Full regression suite | Last full fast stage passed | 492 files passed; 2,894 tests passed, one skipped. |
| Production build | Passing locally | Latest build prerendered eight documents; service-worker generation succeeded. All 68 production browser checks pass locally and on Netlify; three offline/PWA checks pass locally, including iOS install metadata. |
| Active docs and release note | Updated | Architecture, deployment, testing, locale, contributor, agent and Lighthouse guidance updated; dated guidance archived. Exactly one release entry remains draft. |
| React/type diagnostics | Reviewed, limitations remain | React Doctor: 61/100, zero errors, eight warnings. Full-project TypeScript remains an existing tracked problem (#556); 474 full-project diagnostics remain, with zero in the new native/domain modules in the checked candidate. No clean full-project type check is claimed. |
| PR, integration merge and preview | Foundation and first-paint stabilization merged into integration | #560 merged as `e95a241f`; #563 passed final CI and merged as `12222d714`. Production is unchanged. Follow-up branch `codex/tanstack-start-performance` addresses [#562](https://github.com/chrizzzly87/travelflow/issues/562) and [#561](https://github.com/chrizzzly87/travelflow/issues/561). |
| Before/after benchmark | Measured and documented | Clean `b127e152` candidate versus production baseline, same five-run method. Readiness: home −7.5%, wizard −27.8%, pricing +18.0%, example +9.6%. Mixed result; see raw evidence and limits. |

### Architecture direction

Use native TanStack route layouts for public pages, auth/account, creation, trip workspace and admin. Routes own their loading, access checks and rendering boundaries. Public pages must not import the trip workspace or admin application graph through the shared shell. Keep trip session state scoped to trip identity and extract persistence, creation and view preferences into separate modules.

The initial approach of translating the legacy route registry into generated route copies has been discarded. A temporary navigation adapter supports existing callers during conversion; production route ownership and test history are native TanStack. Replace obsolete prefetch and prerender workarounds according to their purpose, preserving first-click handling, theme initialization and supported URLs where still needed.

Next milestone: separate optional trip generation/recovery under [#566](https://github.com/chrizzzly87/travelflow/issues/566), branch `codex/tanstack-start-trip-runtime`, and compare its emitted graph and cold-route measurements. PR #563 has passed final remote CI and merged into integration only. Responsive-image measurements are recorded: median Lighthouse 89, LCP 3.26 s, zero mobile frame requests. This follow-up passes 2,894 core tests, all 68 production browser checks locally and on Netlify, and three offline/PWA checks locally. The preceding first-paint runtime `eaad9a0d` passes 66/66 hosted checks; its homepage Lighthouse median is 88 versus actual production 76. Keep real OAuth/login/reset, active member/admin actions and paid generation as explicit preview acceptance items. Continue cold-route and bundle investigation under #561. Production remains unchanged.

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


## Optional trip runtime milestone — PR #567

Branch `codex/tanstack-start-trip-runtime`; [issue #566](https://github.com/chrizzzly87/travelflow/issues/566),
[PR #567](https://github.com/chrizzzly87/travelflow/pull/567), integration target only.
[Verified preview](https://deploy-preview-567--travelflowapp.netlify.app/) runtime `d89a5a37`
passes all 72 hosted Chromium/WebKit checks. Local gates: 502 files / 2,932 tests,
one skipped, 72 browser checks and three offline/PWA checks. TypeScript remains at
474 existing diagnostics with zero new errors; Doctor remains 61/100 with zero errors.

[Clean five-run comparison and graph evidence](../performance/tanstack-start-2026-10-19/trip-runtime.md):
example readiness **3.50 → 2.98 s (−14.9%)**, JavaScript gzip estimate **786,633 → 708,434 B (−9.94%)**.
Public/creation readiness differs by less than 1%; their JS increases about 0.35%.
The source guard and emitted graph prove ordinary viewing no longer statically
reaches the targeted authoring/generation modules. Conflict recovery owns its
complete normalized link and yields focus to login. Deferred actions are invalidated
when the committed trip/session changes or unmounts.

PR #567 is now merged into integration; see the navigation milestone below for
the next work. Main/production and live account/provider acceptance remain unchanged.

## Navigation and account-home milestone — issue #568

PR #567 merged into integration as `91d7bf7af` on 2026-10-19; its last documentation
CI is complete. The current follow-up is `codex/tanstack-start-navigation`, tracked
in [issue #568](https://github.com/chrizzzly87/travelflow/issues/568): native requested
navigation state, persistent foreground progress, reduced-motion-aware transitions,
retained home presentation during the verified account handoff, and removal of the
retired private profile identity block. Compact account actions now own their UI
separately from the trip library and public profile.

Local acceptance passes: 505 test files / 2,937 tests, one existing skip; all 78
Chromium/WebKit production checks and three offline/PWA checks. React Doctor stays
at 61/100 with zero errors; TypeScript has no new normalized diagnostics (473
existing versus 474 baseline). Runtime commit: `faf632f6`.
[PR #569](https://github.com/chrizzzly87/travelflow/pull/569), linked to issue #568,
records hosted acceptance and current CI/deploy status.
[Navigation preview](https://deploy-preview-569--travelflowapp.netlify.app/). Canonical prerender paths and further measured
trip-view decomposition remain subsequent #561 work. No main or production merge.


### Navigation feedback corrections in PR #569

User review requested a completing full-width top bar, direct guest sign-in, a
public homepage for members with My trips, and no second content loader when
opening an example. These changes are implemented on the same navigation branch;
preview acceptance for the new revision is recorded on PR #569. General login now
defaults to profile while explicit trip/admin return intents remain intact.
Required trip-view code is owned by the native route component preload. Shared
images also recover once from an optimization failure. No persistent broken
homepage asset was reproduced; the user confirmed the preview currently works.

The localized prerender follow-up is tracked in issue #570 on
`codex/tanstack-start-prerender`; its uncommitted work is safely stashed while these
review corrections are finished. It addresses canonical redirect hops and public
localized entry documents, with emitted-output validation and before/after HTTP
evidence. Resume it after the navigation preview is deployed and reviewed.
