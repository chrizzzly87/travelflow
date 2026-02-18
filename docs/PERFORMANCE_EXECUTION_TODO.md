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
- [ ] Route-level performance checks for `/`, `/create-trip`, `/trip/:id`.

## Current baseline snapshot (before this phase)
- [x] Initial JS (raw) observed around 2.0 MB total from entry + static imports.
- [x] Initial CSS (raw) observed around 989 KB.
- [x] `App.tsx` very large and centralizing many concerns.

## Latest measured snapshot (after Phase 2 extraction work)
- [x] Build entry JS: `assets/index-_8INotW_.js` at `~793.14 KB` raw (`~166.72 KB` gzip).
- [x] Build entry CSS: `assets/index-BXAyU8o6.css` at `~987.87 KB` raw (`~110.91 KB` gzip).
- [x] `dist/index.html` now loads one module script and one stylesheet only (no modulepreload list).
- [x] `dist/.vite/manifest.json` shows `index.html.imports = []` and `dynamicImports = 197`.
- [x] Critical entry path (JS+CSS, unique) improved from `~1966.35 KiB` to `~1762.42 KiB`.

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
- [ ] `app/bootstrap/*` (providers + startup effects)
- [ ] `app/routes/*` (route table)
- [x] `app/trip/*` (trip loaders/handlers)
- [ ] `app/prefetch/*` (route preload + warmup logic)
- [ ] Eliminate duplicated route preload definitions by moving to one source of truth.

## Phase 3: Additional first-load wins (next)
- [ ] Reduce globally mounted heavy UI dependencies on marketing entry path.
- [ ] Audit language selector/header dependency graph for lightweight path.
- [ ] Keep admin-specific dependencies loading only in admin routes.
- [ ] Re-check CSS payload and extract non-critical styles where safe.

## Validation checklist
- [x] `npx vite build`
- [x] Inspect `dist/index.html` modulepreload list.
- [x] Inspect `dist/.vite/manifest.json` import graph for `index.html`.
- [ ] Run route perf checks on `/`, `/create-trip`, `/trip/:id`.
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
- Next highest-impact target: reduce global CSS payload and split remaining `App.tsx` startup concerns (route tables, bootstrap side effects).
