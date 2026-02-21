# Performance Execution TODO

Last updated: 2026-02-20
Owner: Codex + @chrizzzly
Scope focus: first-load speed (`/`, `/trip/:id`), admin isolation, app structure clarity.

## Product decisions (locked)
- [x] Prioritize first-load speed over early aggressive prefetch.
- [x] Keep Astro as fallback idea only (do not implement now).
- [x] Isolate admin concerns so public/marketing critical path stays lean.

## Success criteria
- [x] Homepage (`/`) JS critical path reduced substantially vs current baseline.
- [x] Admin code is no longer part of initial entry preload graph.
- [x] Prefetch/speculation starts only after app is usable (idle/first interaction).
- [x] Route-level performance checks for `/`, `/create-trip`, `/trip/:id`.

## Current baseline snapshot (before this phase)
- [x] Initial JS (raw) observed around 2.0 MB total from entry + static imports.
- [x] Initial CSS (raw) observed around 989 KB.
- [x] `App.tsx` very large and centralizing many concerns.

## Latest measured snapshot (after admin deferral + provider-shell extraction pass)
- [x] Build entry JS: `assets/index-CV-y_TAw.js` at `~795.10 KB` raw (`~167.40 KB` gzip).
- [x] Build entry CSS: `assets/index-CT96qplL.css` at `~157.76 KB` raw (`~25.06 KB` gzip).
- [x] `dist/index.html` now loads one module script and one stylesheet only (no modulepreload list).
- [x] `dist/.vite/manifest.json` shows `index.html.imports = []` and `dynamicImports = 179`.
- [x] Critical entry path (JS+CSS, unique) reduced further to `~930.48 KiB` (from prior baseline `~1762.42 KiB`).
- [x] Entry CSS now has `0` inlined `data:image` payloads (SVGs emitted as external assets).
- [x] `App.tsx` reduced from `1076` lines to `411` lines by extracting route/prefetch/bootstrap modules.
- [x] `SiteHeader` now dynamically imports `MobileMenu` and `AccountMenu`; the heavy select implementation is no longer in the header initial-load graph.
- [x] A previous perf pass removed global `flagpack` stylesheet import and switched `FlagIcon` rendering to emoji to cut CSS payload.
- [x] Product UX requirement now restores Flagpack real flags in language/destination selects; re-baseline perf impact in the next measurement pass.
- [x] `MobileMenu` now defers admin navigation config loading via dynamic import; admin metadata is no longer statically bundled into shared menu code.

## Route perf check snapshot (Lighthouse, local preview, mobile profile)
- [x] `/` improved from `41` to `76-78` score after deferring eager carousel prewarm + desktop-only plane-window media.
- [x] `/` transfer dropped from `~2420.9 KiB` to `~1266.4 KiB` (`-~1154.5 KiB`), with large TBT reduction (`~2470 ms` to single-/double-digit ms in repeat runs).
- [x] `/create-trip` remained stable in the `80-83` score range across follow-up runs (normal Lighthouse variance observed).
- [x] `/trip/:id` improved from `71` to `74-76` score in follow-up runs.
- [x] Reports captured in `tmp/perf/*.json` during this session for before/after comparison.
- [x] After header split, `/` remained stable at `76` while transfer dropped further to `~1244.8 KiB` and still avoids loading `select`/`MobileMenu`/`AccountMenu` on first paint.
- [x] After header split, `/create-trip` remained stable at `82` with no regression in TBT (`~25 ms`).
- [x] After removing global flag CSS, `/` improved to `82` with transfer reduced to `~1227.5 KiB`.
- [x] After removing global flag CSS, `/create-trip` stayed stable at `81` and transfer reduced to `~704.7 KiB`.
- [x] After disabling module-preload graphing and tightening warmup/prefetch gating, build entry JS dropped to `~347.29 KB` raw (`~107.25 KB` gzip).
- [x] With the new gating pass, `/` held at `85-86` score with transfer stable around `~374.2 KiB`.
- [x] With idle warmups removed on `/` and `/create-trip`, `/create-trip` transfer dropped from `~659.1 KiB` to `~485.3 KiB` while score stayed stable/improved (`82` to `83` in follow-up run).
- [x] After gating login-modal rendering to open-state only, `/` improved from `85` to `90` in follow-up run with script transfer reduced from `~268.7 KiB` to `~204.5 KiB` and request count reduced from `39` to `33`.
- [x] After changing auth bootstrap on non-critical marketing routes to interaction-triggered only, `/` stopped loading `supabase`/`authService` on initial render and improved from `~309.9 KiB` to `~263.0 KiB` transfer (`33` to `30` requests, score `90` to `92` in follow-up run).
- [x] Split destination/catalog + prefill decode logic out of monolithic `utils.ts`; shared `utils` build chunk dropped from `~437.66 KB` raw to `~32.30 KB` raw (new `destinationService` chunk is now isolated to destination-heavy flows).
- [x] After suppressing passive (viewport/hover/focus) prefetch on `/`, `/create-trip`, `/trip`, `/example`, homepage stayed lean (`~263.0 KiB` transfer) while keeping click/touch-triggered warmups.
- [x] Consolidated first-load-critical path detection into `app/prefetch/isFirstLoadCriticalPath.ts` and applied it to both passive navigation prefetch and speculation-rules mounting.
- [x] Verified Lighthouse runs against `/trip/test` end on final URL `/create-trip` due missing-trip redirect; create-trip chunk loading in that scenario is expected behavior for that test URL (not a passive prefetch regression).
- [x] Routed `TripView` DB calls through `services/dbApi.ts` so `routes/TripRouteLoaders.tsx` no longer statically imports `dbService`/`supabaseClient`.
- [x] After lazy-loading AI helpers inside trip-side panels, `/example/thailand-islands` no longer fetches `aiService` on first load and improved from `87` to `91` score with transfer dropping from `~504.2 KiB` to `~449.0 KiB`.
- [x] Moved release-notice rendering (markdown + release-note parsing) out of static `TripView` imports into a lazy chunk gated by first interaction/idle; `/example/thailand-islands` transfer dropped further from `~449.0 KiB` to `~415.4 KiB` and no longer requests `ReleasePill`/`releaseNotesService` on initial load.
- [x] Lazy-loaded `MarkdownEditor` (in details + print flows) and `PrintLayout` itself so markdown parsing/print UI are no longer in the trip static import path; `/example/thailand-islands` improved from `~410.3 KiB` to `~359.9 KiB` transfer (`36` to `35` requests) and trip static graph dropped from `~865.5 KiB` to `~691.6 KiB`.
- [x] Deferred `DetailsPanel`/`SelectedCitiesPanel` behind lazy imports so trip details tooling loads only after selection; `/example/thailand-islands` improved from `~359.9 KiB` to `~345.0 KiB` transfer (`35` to `34` requests) and trip static graph dropped further from `~691.6 KiB` to `~640.5 KiB`.
- [x] Deferred mobile drawer shell (`TripDetailsDrawer`) behind open-state lazy loading so Radix/scroll-lock code is excluded from initial trip render; `/example/thailand-islands` improved from `~345.0 KiB` to `~326.3 KiB` transfer (`34` to `32` requests) and trip static graph dropped from `~640.5 KiB` to `~584.3 KiB`.
- [x] Replaced the admin-override Radix `Switch` in trip view with a lightweight native toggle, removing remaining Radix switch primitives from the trip static graph; `/example/thailand-islands` improved from `~326.3 KiB` to `~322.9 KiB` transfer (`32` to `31` requests) and static graph dropped from `~584.3 KiB` to `~576.9 KiB`.
- [x] Deferred `AddActivityModal` and `AddCityModal` behind open-state lazy loading so planner modals load on demand; `/example/thailand-islands` improved from `~322.9 KiB` to `~318.7 KiB` transfer (`31` to `29` requests) and trip static graph dropped from `~576.9 KiB` to `~565.5 KiB`.
- [x] Deferred `CountryInfo` rendering behind lazy loading inside the trip-info overlay so destination metadata UI no longer ships in initial trip bundles; `/example/thailand-islands` improved from `~318.7 KiB` to `~316.7 KiB` transfer and trip static graph dropped from `~565.5 KiB` to `~559.2 KiB`.
- [x] Deferred the share dialog (`TripShareModal`) behind lazy loading so sharing controls load only when opened; `/example/thailand-islands` improved slightly from `~316.7 KiB` to `~316.5 KiB` transfer and static graph dropped from `~559.2 KiB` to `~557.0 KiB`.
- [x] Deferred the full history dialog (`TripHistoryModal`) behind lazy loading so history UI is fetched only on demand; `/example/thailand-islands` improved slightly from `~316.5 KiB` to `~316.2 KiB` transfer and static graph dropped from `~557.0 KiB` to `~554.6 KiB`.
- [x] Deferred the trip-info overlay shell (`TripInfoModal`) behind lazy loading so trip-info UI only loads on demand; `/example/thailand-islands` improved from `~316.2 KiB` to `~313.9 KiB` transfer (`29` to `27` requests) and trip static graph dropped from `~554.6 KiB` to `~536.8 KiB`.
- [x] Deferred the non-default `VerticalTimeline` bundle so default horizontal trip render no longer ships both timeline variants upfront; `/example/thailand-islands` improved from `~313.9 KiB` to `~312.3 KiB` transfer (`27` requests stable) with score improvement (`88` to `90`) and trip static graph reduction from `~536.8 KiB` to `~522.4 KiB`.
- [x] Removed `/example/:templateId` dependency on heavy `exampleTripCards` data during initial loader hydration by sourcing lightweight title/country metadata from a dedicated loader-runtime module; `/example/thailand-islands` transfer dropped from `~312.3 KiB` to `~306.9 KiB` (`27` to `26` requests) and no longer requests `exampleTripCards` on first load.
- [x] Replaced monolithic example-template index loading with per-template dynamic factory imports for `/example/:templateId`; `/example/thailand-islands` transfer dropped further from `~306.9 KiB` to `~286.9 KiB` (`26` to `27` requests) while keeping score stable/improved (`88` to `89`) and removing first-load requests for the large `exampleTripTemplates` index chunk.
- [x] Simplified i18n bootstrap by replacing runtime language-detector/ICU plugins with lightweight app-local locale detection and `{}` interpolation config; build entry JS dropped from `~348.58 KB` raw (`~107.55 KB` gzip) to `~302.74 KB` raw (`~94.31 KB` gzip).
- [x] After the i18n bootstrap simplification pass, homepage `/` improved to `96` score with `~254.7 KiB` transfer (`31` requests, `FCP ~1867 ms`, `LCP ~2642 ms`, `TBT 0 ms`).
- [x] After the i18n bootstrap simplification pass, `/create-trip` measured `84` score with `~469.7 KiB` transfer (`54` requests, `FCP ~2435 ms`, `LCP ~3961 ms`, `TBT ~29 ms`).
- [x] After the i18n bootstrap simplification pass, `/example/thailand-islands` improved from `~286.9 KiB` to `~273.9 KiB` transfer (`27` requests, score `90`, `FCP ~2123 ms`, `LCP ~3330 ms`, `TBT ~4 ms`).
- [x] Deferred `NavigationPrefetchManager` and `SpeculationRulesManager` behind lazy chunks so prefetch infra/config no longer loads in the initial entry bundle.
- [x] Updated warmup gating to interaction-only on first-load-critical paths (`/`, `/create-trip`, `/trip`, `/example`) so deferred prefetch chunks do not load during first paint/idle on those entries.
- [x] After prefetch-manager deferral + critical-path interaction-only warmup, build entry JS dropped from `~302.74 KB` raw (`~94.31 KB` gzip) to `~291.67 KB` raw (`~91.66 KB` gzip).
- [x] With this pass, homepage `/` stayed strong at `95` score with improved transfer (`~252.2 KiB`, `31` requests, `FCP ~1782 ms`, `LCP ~2583 ms`).
- [x] With this pass, `/create-trip` improved to `96` score with transfer reduced to `~467.1 KiB` (`54` requests, `FCP ~1759 ms`, `LCP ~2555 ms`).
- [x] With this pass, `/example/thailand-islands` improved to `94` score with transfer reduced to `~271.3 KiB` (`27` requests, `FCP ~1940 ms`, `LCP ~2763 ms`).
- [x] Split non-critical route-table concerns into lazy `DeferredAppRoutes`; `AppRoutes.tsx` now contains only first-load-critical route wiring (`179` lines) while secondary marketing/admin/profile/lab routes are loaded on demand.
- [x] After deferred route-table extraction, build entry JS dropped from `~291.67 KB` raw (`~91.66 KB` gzip) to `~284.38 KB` raw (`~90.20 KB` gzip).
- [x] After deferred route-table extraction, homepage `/` stayed at `95` score with transfer reduced from `~252.2 KiB` to `~250.7 KiB` (`31` requests, `FCP ~1874 ms`, `LCP ~2707 ms`).
- [x] After deferred route-table extraction, `/create-trip` improved to `92` score with transfer reduced from `~467.1 KiB` to `~465.7 KiB` (`54` requests, `FCP ~1887 ms`, `LCP ~2770 ms`).
- [x] After deferred route-table extraction, `/example/thailand-islands` improved to `95` score with transfer reduced from `~271.3 KiB` to `~269.8 KiB` (`27` requests, `FCP ~1800 ms`, `LCP ~2548 ms`).
- [x] Split Tailwind output into critical entry CSS (`index.css`) and deferred route CSS (`styles/deferred-routes.css`) using `@source` include/exclude rules tied to `DeferredAppRoutes`.
- [x] Entry CSS dropped from `~158.36 KB` raw (`~25.11 KB` gzip) to `~127.75 KB` raw (`~21.51 KB` gzip); deferred non-critical routes now load `DeferredAppRoutes.css` (`~71.23 KB` raw, `~12.30 KB` gzip) on demand.
- [x] Split `TripView` map code into a dedicated lazy chunk: `TripView` dropped from `~132.66 KB` raw (`~36.64 KB` gzip) to `~106.03 KB` raw (`~29.87 KB` gzip), while new `ItineraryMap` chunk is `~28.01 KB` raw (`~7.91 KB` gzip).
- [x] Deferred `GoogleMapsLoader` bootstrap behind a map-visibility + delay gate with interaction/timeout fallback so map script loading does not start during planner-shell first paint.
- [x] After map-bootstrap gating logic was added, `TripView` stayed near the post-split size (`~107.78 KB` raw, `~30.39 KB` gzip), preserving most of the previous map-splitting bundle win.
- [x] After CSS splitting, homepage `/` transfer dropped to `~247.3 KiB` (`31` requests) with stable high Lighthouse performance (`91-93` across follow-up runs).
- [x] After CSS splitting, `/create-trip` transfer dropped to `~462.3 KiB` (`54` requests) with stable high Lighthouse performance (`91-93` across follow-up runs).
- [x] After CSS splitting, `/example/thailand-islands` transfer dropped to `~266.4 KiB` (`27` requests, score `96` in measured run).
- [x] Follow-up Lighthouse after map-split showed stable transfer envelopes on key entry routes (`/` `~247.3 KiB`, `/create-trip` `~462.3 KiB`, `/example/thailand-islands` `~266.5 KiB`) with no payload regression from the chunk move.
- [x] Follow-up Lighthouse after map-bootstrap gating stayed within prior transfer envelopes (`/` `~247.3 KiB`, `/create-trip` `~462.4 KiB`, `/example/thailand-islands` `~267.0 KiB`) while reducing early map-script pressure on trip-entry startup.
- [x] Follow-up Lighthouse after warning/accessibility cleanup remained strong (`/` `98`, `/create-trip` `94`, `/example/thailand-islands` `97`) with transfer envelopes unchanged (`~247.4 KiB`, `~462.4 KiB`, `~267.3 KiB`).
- [x] React-doctor cleanup pass reduced warning count from `215` to `206` and improved score from `89` to `90` by addressing low-risk planner accessibility/focus issues.
- [x] Verified deferred stylesheet loading on non-critical route `/features` (`DeferredAppRoutes-*.css` requested at runtime), confirming style separation is active.
- [x] Split `routes/TripRouteLoaders.tsx` into route-specific lazy modules (`TripLoaderRoute`, `SharedTripLoaderRoute`, `ExampleTripLoaderRoute`) so loader code is no longer bundled as one shared loader chunk.
- [x] Verified route-loader chunk isolation in build output: `TripLoaderRoute` `~3.22 KB` raw (`~1.51 KB` gzip), `SharedTripLoaderRoute` `~4.06 KB` raw (`~1.87 KB` gzip), `ExampleTripLoaderRoute` `~5.02 KB` raw (`~2.15 KB` gzip).
- [x] Restored `/trip/:id` DB fallback to `/s/:token` via `trip-share-resolve` so merged main share-resolution behavior is preserved in modular route loaders.
- [x] Removed conditional hook execution in `NavigationPrefetchManager` by keeping hooks always mounted and gating behavior internally with `isPrefetchActive`.
- [x] Removed `TripView` admin-override state reset effect and moved reset semantics to keyed `TripView` mounting in the trip loader route.
- [x] Re-ran `react-doctor` after these changes: score improved from `86` to `89` and blocking errors dropped from `4` to `0`.
- [x] Ran `/trip/:id` Lighthouse against a valid non-redirecting trip URL (`/trip/<compressed-state>`) and captured fresh baselines in `tmp/perf/trip-real-url-baseline-mobile.json` and `tmp/perf/trip-real-url-baseline.json`.
- [x] New `/trip/:id` valid-URL baseline (mobile profile): score `91`, `FCP ~2040 ms`, `LCP ~3172 ms`, `TBT ~17 ms`, transfer `~390.4 KiB`, `31` requests.
- [x] New `/trip/:id` valid-URL baseline (desktop profile): score `100`, `FCP ~511 ms`, `LCP ~734 ms`, `TBT 0 ms`, transfer `~390.4 KiB`, `31` requests.
- [x] Fresh follow-up real-URL `/trip/:id` Lighthouse runs after latest TripView/react-doctor cleanup (2026-02-20): desktop remained `100` (`FCP ~0.5 s`, `LCP ~0.7 s`, `TBT 0 ms`) with transfer `~394 KiB` (`32` requests); mobile runs measured `87` and `82` (`FCP ~2.3-2.6 s`, `LCP ~3.6-4.2 s`, `TBT 0 ms`) at the same transfer envelope (`~394 KiB`, `32` requests), indicating expected mobile variance with no blocking-time regression.
- [x] Extracted trip map bootstrap orchestration from `TripView` into `components/tripview/useDeferredMapBootstrap.ts` (visibility/delay/interaction/max-wait gates unchanged) to reduce `TripView` complexity and keep map-loading logic isolated.
- [x] Follow-up `react-doctor` passes after trip refactor + history-open/timeline-render cleanup improved score from `90` to `91` and reduced warnings from `209` to `203`.
- [x] Added a `TripInfoModal` suspense loading shell + intent prewarm (`hover`/`focus`/`touchstart`) so the modal opens immediately while its lazy chunk resolves in the background.
- [x] Extracted trip history + overlay orchestration from `TripView` into focused hooks (`useTripHistoryController`, `useTripOverlayController`), reducing `TripView.tsx` from `3418` to `3232` lines while keeping undo/redo, popstate, and escape behavior intact.
- [x] Cleared remaining high-signal `react-doctor` accessibility issues in trip-focused modals (`TripInfoModal`, `TripHistoryModal`, `TripShareModal`, `AddActivityModal`), reducing project warning count from `203` to `177` in the latest pass.

## Phase 1: Critical path isolation
- [x] Keep `vite.config.ts` without manual chunk overrides (current best first-load result).
- [x] Add runtime warmup gate so prefetch/speculation does not run immediately on first paint.
- [x] Pass warmup gate into `NavigationPrefetchManager` + `SpeculationRulesManager`.
- [x] Keep fallback route prewarm (`ViewTransitionHandler`) behind same warmup gate.
- [x] Rebuild and verify `dist/index.html` no longer preloads admin chunk.
- [x] Rebuild and record updated entry/preload chunk sizes.

## Phase 2: App structure cleanup (in progress)
- [x] Extract trip/share/example route loaders into `routes/TripRouteLoaders.tsx`.
- [x] Move DB loader wrappers into `services/dbApi.ts`.
- [x] Decouple `DB_ENABLED` from `supabaseClient` runtime import in `config/db.ts`.
- [x] Lazy-load `AuthModal` from `LoginModalContext`.
- [x] Lazy-load AuthContext service calls via dynamic auth/supabase imports.
- [x] Split remaining `App.tsx` responsibilities into focused modules:
- [x] `app/bootstrap/*` (providers + startup effects; provider shell extracted to `AppProviderShell`)
- [x] `app/routes/*` (route table)
- [x] `app/trip/*` (trip loaders/handlers)
- [x] `app/prefetch/*` (route preload + warmup logic)
- [x] Eliminate duplicated route preload definitions by moving to one source of truth.
- [x] Split route-loader concerns into dedicated files per route (`routes/TripLoaderRoute.tsx`, `routes/SharedTripLoaderRoute.tsx`, `routes/ExampleTripLoaderRoute.tsx`) and kept `routes/TripRouteLoaders.tsx` as a lightweight compatibility barrel.

## Phase 3: Additional first-load wins (next)
- [x] Reduce globally mounted heavy UI dependencies on marketing entry path.
- [x] Audit language selector/header dependency graph for lightweight path.
- [x] Keep admin-specific dependencies out of shared non-admin initial paths (admin nav config deferred behind admin-only runtime check).
- [x] Disable build-time asset inlining to stop large flag SVG data URIs from inflating entry CSS.
- [x] Re-check CSS payload and extract non-critical styles where safe.
- [x] Defer homepage example carousel code/data loading until the section intersects viewport.
- [x] Move app runtime helpers out of `utils.ts` to avoid keeping `App.tsx` tied to the monolithic utility module.
- [x] Remove idle warmup targets for `/` and `/create-trip`; keep warmup mostly interaction-driven with longer fallback delay.
- [x] Disable `build.modulePreload` to avoid eager dependency preload fan-out from the entry chunk.
- [x] Gate `AuthModal` lazy component rendering so the login modal bundle is fetched only when the modal is actually opened.
- [x] Make auth bootstrap interaction-triggered on non-auth-critical marketing entries while keeping immediate bootstrap on auth-critical routes and callback payloads.
- [x] Extract destination lookup/indexing logic into `services/destinationService.ts` and move prefill decoding into `services/tripPrefillDecoder.ts` to break `utils.ts` into smaller domain modules.
- [x] Suppress passive navigation prefetch (viewport/hover/focus) on first-load-critical paths while preserving explicit interaction-triggered prefetch.
- [x] Move `TripView` DB-side effects behind `dbApi` wrappers to keep Supabase runtime code out of static trip-route imports.
- [x] Lazy-load trip AI helper calls inside `DetailsPanel` and `AddActivityModal` so `aiService` only loads when a user triggers AI actions.
- [x] Extract release notice UI/markdown logic from `TripView` into a lazy-loaded component and defer mounting behind interaction/idle gating.
- [x] Lazy-load `MarkdownEditor` inside details/print flows and lazy-load `PrintLayout` in `TripView` so markdown/parser bundles do not block initial trip render.
- [x] Lazy-load `DetailsPanel` and `SelectedCitiesPanel` in `TripView` so heavy detail-editing logic is loaded only when users select timeline items.
- [x] Extract mobile details drawer shell into a lazy chunk and mount it only when details are opened on mobile.
- [x] Replace the admin edit-override toggle with a lightweight native control so `TripView` no longer depends on Radix `Switch` at load time.
- [x] Lazy-load `AddActivityModal` and `AddCityModal` in `TripView` so add-flow UI code is fetched only when modals are opened.
- [x] Lazy-load `CountryInfo` in `TripView` so destination metadata UI is fetched only when the trip-info overlay is opened.
- [x] Lazy-load `TripShareModal` in `TripView` so share UI code is fetched only when the share dialog is opened.
- [x] Lazy-load `TripHistoryModal` in `TripView` so history navigation UI is fetched only when the history dialog is opened.
- [x] Lazy-load `TripInfoModal` in `TripView` so trip metadata/history overlay chrome is fetched only when users open trip info.
- [x] Lazy-load `VerticalTimeline` in `TripView` so default horizontal timeline mode does not include both timeline variants in the initial bundle.
- [x] Read example-route banner metadata from a lightweight loader-runtime module so `/example/:templateId` avoids loading the marketing card dataset during first-load trip hydration.
- [x] Load `/example/:templateId` template factories via per-template dynamic imports so example entry routes avoid fetching the monolithic templates index on first render.
- [x] Replace i18n runtime plugins (`i18next-browser-languagedetector`, `i18next-icu`) with lightweight local locale detection + `{}` interpolation setup to reduce shared entry bundle cost.
- [x] Lazy-load navigation prefetch/speculation managers and make warmup interaction-only on first-load-critical paths so prefetch infrastructure stays out of critical first render.
- [x] Keep only critical routes in `app/routes/AppRoutes.tsx` and move secondary marketing/profile/admin/create-trip-lab routes to lazy `app/routes/DeferredAppRoutes.tsx`.
- [x] Split Tailwind scanning/output between critical and deferred routes so entry CSS excludes non-critical/admin/page-class payload until deferred routes load.
- [x] Split `ItineraryMap` from `TripView` into a lazy chunk to keep the core planner UI module smaller and easier to iterate independently.
- [x] Defer map-script bootstrap until map container visibility + short delay (or first interaction), with a max-wait safety fallback.
- [x] Resolve low-risk planner `react-doctor` findings (title edit semantics, keyboard-accessible resize handles, and modal focus management) without impacting route transfer budgets.
- [x] Prewarm the lazy `TripManager` chunk on explicit My Plans trigger intent (`hover`/`focus`/`touchstart`) to reduce first-open latency without adding first-render payload.
- [x] Extract history/overlay orchestration from `TripView` into dedicated hooks to continue shrinking the main planner component.
- [x] Resolve high-signal trip-modal `react-doctor` accessibility findings with semantic dialog/backdrop and label-control associations.
- [x] Added a shared focus-trap hook and wired it into custom dialogs/overlays/sidepanels (`TripInfo`, `TripHistory`, `TripShare`, `AddActivity`, `AddCity`, `DeleteCity`, `Settings`, release notice, mobile menu, My Plans panel) so keyboard focus stays inside open overlays.
- [x] Follow-up `react-doctor` after focus-trap rollout improved from `91/177` to `91/175` by removing remaining modal/overlay accessibility regressions introduced during the pass.
- [x] Replaced remaining clickable non-semantic wrappers in destination pickers and print-calendar interactions with semantic controls (buttons + explicit label/input associations), removing those surfaces from `react-doctor` high-signal accessibility findings.
- [x] Follow-up `react-doctor` after the semantic-control pass improved warnings from `175` to `163` (score held at `91`) while reducing flagged files from `24` to `22`.
- [x] Extracted timeline-render orchestration from `TripView` into `components/tripview/TripTimelineCanvas.tsx`, reducing `TripView.tsx` from `3244` lines to `3203` lines while preserving timeline behavior and warning counts (`react-doctor` stayed `91/163`).
- [x] Cleared remaining trip `DetailsPanel` non-semantic click targets (hotel search results + overlay backdrop) and replaced index-based hotel-result keys with stable identifiers, reducing `react-doctor` warnings from `163` to `158` while keeping score at `91`.
- [x] Added a shared Radix-based `AppModal` shell (`components/ui/app-modal.tsx`) and migrated `TripInfoModal`, `TripShareModal`, and `TripHistoryModal` to the unified modal primitive for consistent ESC/backdrop close + focus management behavior.
- [x] Verified modal-shell migration with full build + `react-doctor`; score/warnings remained stable at `91/158` (no regression).
- [x] Migrated remaining planner dialogs (`AddCity`, `AddActivity`, `DeleteCity`, `Settings`) to the shared `AppModal` shell and removed duplicated per-dialog focus/escape handling.
- [x] Verified the expanded modal-shell rollout with full validation (`npm run build`, `npx -y react-doctor@latest . --verbose --diff`, `npm run updates:validate`); `react-doctor` improved from `91/158` to `91/157`.
- [x] Extracted trip history presentation mapping (`historyModalItems`, `tripInfoHistoryItems`, history-open wiring) from `TripView` into `components/tripview/useTripHistoryPresentation.ts`, reducing `TripView.tsx` from `3203` lines to `3120`.
- [x] Follow-up trip-page cleanup in `DetailsPanel` removed remaining default-array + index-key + prop-init lint hotspots; `react-doctor` improved from `91/157` to `93/153`.
- [x] Fixed label/control associations in `CreateTripForm` (classic, wizard, and surprise modes), reducing form-a11y lint debt and improving `react-doctor` from `93/153` to `93/143`.
- [x] Added shared focus-trap enforcement to the global auth login/register modal and queued guest-auth overlay so keyboard tab focus no longer escapes into background page content.
- [x] Cleared the current blocking `react-doctor` errors on blog routes by removing conditional hook flow in `BlogPostPage` and replacing locale-derived filter reset effects in `BlogPage` with locale-scoped state.
- [x] Extracted repeated selected-item/details wiring in `TripView` into shared computed panel content (`selectedDetailItem`, `selectedRouteStatus`, `detailsPanelContent`), reducing `TripView.tsx` from `3120` to `3064` lines and lowering the emitted `TripView` chunk from `114.88 KiB` to `113.33 KiB` (gzip stable at `~32.38 KiB`).
- [x] Follow-up `react-doctor` on changed files reported `98/100` with only structural TripView warnings remaining (`useState` density + component size), with no new accessibility or hook-order regressions.
- [x] Re-ran Lighthouse against the valid `/trip/<compressed-state>` URL after the extraction pass (strict preview mode): desktop stayed `100` (`FCP ~520 ms`, `LCP ~749 ms`, `TBT 0 ms`), and mobile stayed in expected variance at `87` (`FCP/LCP ~2933 ms`, `TBT 0 ms`), with transfer `~402.5 KiB` across `32` requests.
- [x] Removed redundant explicit `ensureDbSession()` calls from shared/example copy flows (`dbUpsertTrip` + `dbCreateTripVersion` already enforce session), trimming a serial await in each path and clearing the `react-doctor` sequential-await warning there.
- [x] Consolidated `SharedTripLoaderRoute` and `ExampleTripLoaderRoute` to single route-state objects (instead of scattered parallel `useState`s), reducing route-loader orchestration complexity and dropping changed-file `react-doctor` warnings from `8` to `7` (`98/100` score held).
- [x] Extracted trip share lifecycle orchestration out of `TripView` into `components/tripview/useTripShareLifecycle.ts` (share-modal state, localStorage share-link cache, and share-lock DB sync), reducing `TripView` warning surface without changing first-load lazy boundaries.
- [x] Extracted `TripView` view-settings synchronization (localStorage persistence + URL sync + initial view-state application) into `components/tripview/useTripViewSettingsSync.ts` and moved generation-overlay progress rotation into `components/tripview/useGenerationProgressMessage.ts`, shrinking `TripView.tsx` from `2668` to `2615` lines.
- [x] Follow-up `react-doctor` after the hook extraction pass improved changed-file warnings from `6` to `4` (score stayed `98/100`), leaving only route-loader effect-setState suggestions and structural `TripView` size/state-density guidance.
- [x] Re-ran strict-preview Lighthouse for the valid `/trip/<compressed-state>` URL after the extraction pass: desktop remained `100` (`FCP ~0.5 s`, `LCP ~0.6 s`, `TBT 0 ms`) and mobile improved to `89` (`FCP ~2.2 s`, `LCP ~3.5 s`, `TBT 0 ms`) with transfer stable at `~403 KiB` across `32` requests.

## Validation checklist
- [x] `npx vite build`
- [x] Inspect `dist/index.html` modulepreload list.
- [x] Inspect `dist/.vite/manifest.json` import graph for `index.html`.
- [x] Run route perf checks on `/`, `/create-trip`, `/trip/:id`.
- [x] Deploy preview to Netlify and verify real environment behavior.

## Useful commands
```bash
# Build and inspect output
npx vite build --manifest
sed -n '90,130p' dist/index.html
node -e "const m=require('./dist/.vite/manifest.json'); console.log(JSON.stringify(m['index.html'],null,2));"

# Netlify preview deploy
npx netlify status
npx netlify deploy --build --json
```

## Notes for continuation
- Do not re-enable eager speculation/prefetch on first render.
- Keep admin optimization goals independent from marketing/page-entry goals.
- If a change regresses first-load, revert that change and capture before/after numbers in this file.
- Next highest-impact target: continue `TripView` structural extraction by moving modal stack/paywall overlay orchestration into dedicated components/hooks, then re-measure `/trip/:id` and `/` with fresh Lighthouse baselines.
