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

## Latest measured snapshot (after header dependency split pass)
- [x] Build entry JS: `assets/index-BapA8BLz.js` at `~795.05 KB` raw (`~167.12 KB` gzip).
- [x] Build entry CSS: `assets/index-DvMAX5CV.css` at `~186.68 KB` raw (`~32.18 KB` gzip).
- [x] `dist/index.html` now loads one module script and one stylesheet only (no modulepreload list).
- [x] `dist/.vite/manifest.json` shows `index.html.imports = []` and `dynamicImports = 179`.
- [x] Critical entry path (JS+CSS, unique) remains at `~958.76 KiB` (from prior baseline `~1762.42 KiB`).
- [x] Entry CSS now has `0` inlined `data:image` payloads (SVGs emitted as external assets).
- [x] `App.tsx` reduced from `1076` lines to `419` lines by extracting route/prefetch/bootstrap modules.
- [x] `SiteHeader` now dynamically imports `MobileMenu` and `AccountMenu`; the heavy select implementation is no longer in the header initial-load graph.

## Route perf check snapshot (Lighthouse, local preview, mobile profile)
- [x] `/` improved from `41` to `76-78` score after deferring eager carousel prewarm + desktop-only plane-window media.
- [x] `/` transfer dropped from `~2420.9 KiB` to `~1266.4 KiB` (`-~1154.5 KiB`), with large TBT reduction (`~2470 ms` to single-/double-digit ms in repeat runs).
- [x] `/create-trip` remained stable in the `80-83` score range across follow-up runs (normal Lighthouse variance observed).
- [x] `/trip/:id` improved from `71` to `74-76` score in follow-up runs.
- [x] Reports captured in `tmp/perf/*.json` during this session for before/after comparison.
- [x] After header split, `/` remained stable at `76` while transfer dropped further to `~1244.8 KiB` and still avoids loading `select`/`MobileMenu`/`AccountMenu` on first paint.
- [x] After header split, `/create-trip` remained stable at `82` with no regression in TBT (`~25 ms`).

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
- [ ] Split remaining `App.tsx` responsibilities into focused modules:
- [ ] `app/bootstrap/*` (providers + startup effects; startup hooks extracted, provider shell still in `App.tsx`)
- [x] `app/routes/*` (route table)
- [x] `app/trip/*` (trip loaders/handlers)
- [x] `app/prefetch/*` (route preload + warmup logic)
- [x] Eliminate duplicated route preload definitions by moving to one source of truth.

## Phase 3: Additional first-load wins (next)
- [x] Reduce globally mounted heavy UI dependencies on marketing entry path.
- [x] Audit language selector/header dependency graph for lightweight path.
- [ ] Keep admin-specific dependencies loading only in admin routes.
- [x] Disable build-time asset inlining to stop large flag SVG data URIs from inflating entry CSS.
- [ ] Re-check CSS payload and extract non-critical styles where safe.

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
- Next highest-impact target: language selector/header dependency audit + keeping admin-only dependencies fully isolated from non-admin route paths.
