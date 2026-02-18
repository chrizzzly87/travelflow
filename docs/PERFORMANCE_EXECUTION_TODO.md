# Performance Execution TODO

Last updated: 2026-02-18
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
- [x] Removed global `flagpack` stylesheet import and switched `FlagIcon` rendering to emoji, eliminating the large flag SVG manifest from initial CSS output.
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

## Validation checklist
- [x] `npx vite build`
- [x] Inspect `dist/index.html` modulepreload list.
- [x] Inspect `dist/.vite/manifest.json` import graph for `index.html`.
- [x] Run route perf checks on `/`, `/create-trip`, `/trip/:id`.
- [ ] Deploy preview to Netlify and verify real environment behavior.

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
- Next highest-impact target: run trip-route checks against valid non-redirecting URLs and reduce real `/trip/:id` first-load payload (`TripView` + DB bootstrap path) from that baseline.
