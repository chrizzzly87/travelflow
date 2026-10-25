# AGENTS.md

Instructions for every coding agent in this repository. This file is the source of truth.
`CLAUDE.md` only imports it and adds Claude-specific notes.

## Project
- This repository (`travelflow` / `travelflow-codex`) is **TravelFlow**. Always call it TravelFlow.
- It deploys only to Netlify project `travelflowapp`:
  - site ID `1abc3d37-f6af-4810-9097-489b2a282ac6`;
  - URL `https://travelflowapp.netlify.app`.
- Before any deploy, run `netlify status` and stop unless `Current project:` reads `travelflowapp`. Resolve the target from the repo, never from memory.
- Stack:
  - TanStack Start 1.169 and TanStack Router 1.170 on React 19, Vite 8, Tailwind 4;
  - Supabase for the database and auth;
  - Netlify functions and edge functions.
- Node 22 (`.node-version`). Node 26 breaks the `StorageEvent` tests; use Node 22 before trusting a local failure.

## Where things live
- **Routes:**
  - `src/virtualRoutes.ts` defines the route graph. `src/routeTree.gen.ts` is generated; never edit it.
  - `src/routes/areas/*` own rendering, access and lifecycle per area. Public pages are server-rendered; auth, account, admin, trips, create and library are `ssr: false`.
  - Leaf routes in `src/routes/**` stay thin and render page modules from `pages/`.
- **Architecture rules:** `docs/TANSTACK_START_ARCHITECTURE.md`. Netlify output and routing: `docs/NETLIFY_TANSTACK_START.md`.
- **Navigation:**
  - Use native TanStack APIs in new route-aware code.
  - `app/navigation.tsx` is the URL-string adapter for existing call sites. Never add a second router, route table or global prefetch graph.
- **Shared UI** is in `components/ui/`. Check `docs/DESIGN_SYSTEM_COMPONENTS.md` before hand-building UI. The admin visual contract is `docs/DESIGN.md`.
- **Domain logic** lives in `features/*`, `services/*` and `shared/*`. Keep page modules and the app shell free of planner/admin business logic.

## Rules by task
- **UI:**
  - Use `Button`, `Input`, `Textarea`, `Select`, `Badge`, `Dialog`/`AppModal` and `Spinner`. Busy actions use `Button loading`.
  - Never use a native `<select>` or native `confirm`/`prompt`; use `useAppDialog`.
  - Overlays are dialogs: `role="dialog"`, `aria-modal`, focus trap, Escape, mobile backdrop, focus restored to the trigger. `DialogContent` already handles `aria-modal` and focus return.
  - Prefer CSS logical properties (`ms`/`me`, `ps`/`pe`, `inset-inline`). Ask if direction handling is unclear.
  - Components used with Radix `asChild`, or focused/measured by a library, must forward refs.
- **Server rendering:**
  - Server output and the first client render must match. Never read storage, `window` or `new Date()` during render on a server-rendered page. Use `useHydrated`, or `useRenderNow()` for "today".
  - Keep request data and i18n instances per request; no request data in module singletons.
  - Public pages are CDN-cached (`app/routing/cachePolicy.ts`). A public page that starts reading cookies or headers during SSR must vary or opt out.
  - Server functions validate input and return only public or authorized data.
- **Effects:** add `useEffect` only to sync with an external system (network, browser APIs, timers, subscriptions, imperative widgets). Prefer render-time derivation, event handlers, `useSyncExternalStore` and `key` resets.
- **Copy:**
  - Follow `docs/UX_COPY_GUIDELINES.md`.
  - New or rewritten user-facing copy needs EN and DE style sign-off from the user unless they opt out.
  - Exempt from sign-off: admin copy (English-only, not localized) and release notes.
- **i18n:**
  - Follow `docs/I18N_PAGE_WORKFLOW.md`.
  - Add every new key to all active locales: `en es de fr pt ru it pl ko fa ur`. Choose the namespace deliberately.
  - Placeholders are single-brace `{name}`, never `{{name}}`.
  - ICU plural/select syntax renders raw, because `i18next-icu` is not registered. Use `key_one`/`key_other` (plus `_few`/`_many` where the locale needs them) with `count`.
  - Canonical slugs are English. Locales are path prefixes only; no localized slug aliases.
- **Analytics:** clickable marketing/planner UI gets `trackEvent(...)` and `getAnalyticsDebugAttributes(...)` per `docs/ANALYTICS_CONVENTION.md`.
- **Browser storage:**
  - Register every key in `lib/legal/cookies.config.ts`; unregistered writes are silently refused.
  - Run `pnpm storage:validate`.
- **Activities and day trips:**
  - Read `docs/ACTIVITIES_AND_DAY_TRIPS.md` first.
  - Resolve a stay only through `shared/activityStay.ts`.
  - Add every new timeline-item field to the Trip Agent's strict `timelineItemSchema` in `shared/tripAgent.ts`.
- **Maps:** follow `docs/MAPS_INTEGRATION_WORKFLOW.md`. For trip-card previews, follow `docs/TRIP_MAP_PREVIEW_CACHING.md`:
  - the endpoint returns image bytes;
  - every query parameter changes the picture;
  - cards use `buildSettledMiniMapUrl`.
- **AI features:** read `docs/AI_AGENT_FEATURE_GUARDRAILS.md` before touching model calls, streaming or stored model output.
  - Never stream, store or render hidden reasoning.
  - No raw exceptions in responses; return a code plus an authored sentence.
  - No `VITE_` credentials server-side.
  - Stay under Netlify's 60 s synchronous limit.
  - Rebuild state from its record, not a transcript.
- **Database:**
  - `supabase/migrations/*.sql` are never applied by a deploy. Verify locally (`supabase/tests/`), follow `docs/SUPABASE_RUNBOOK.md`, and say plainly that a migration is pending.
  - Postgres has no autonomous transactions: return a status and let the caller raise.
- **Content data:** destination guides and recommendations are served from Supabase. Bundled JSON is only a seed.
  - Follow `docs/DESTINATION_INGESTION_RUNBOOK.md` or `docs/RECOMMENDATIONS_CONTENT_RUNBOOK.md`.
  - Verify with `curl` against `/api/destinations/<slug>` or `/api/recommendations?country=XX`.

## Tests and gates
- Behaviour changes need Vitest coverage in the same PR. Bug fixes need a regression test that fails before the fix. Docs, copy and style-only edits are exempt.
- For TripView or route-loader orchestration, scope tests with `docs/TESTING_PHASE2_SCOPE.md`.
- PRs that add files under `services/` or `config/` list the matching `tests/**` entries in the description.
- Commands:
  - `pnpm typecheck` must stay at 0 errors. No `@ts-ignore`/`@ts-nocheck`, blanket `any`, or tsconfig weakening.
  - `pnpm test:core`.
  - `pnpm i18n:validate` for locale changes.
  - `pnpm updates:validate` for release notes.
- Before pushing, run `pnpm ci:local` (about 3–4 min). It mirrors `.github/workflows/pr-quality.yml` stage for stage; keep its STAGES list in step with the workflow.
  - `--fast` skips the build and browser suites.
  - `--only=<stage>` and `--from=<stage>` target or resume one stage.
- A manual `pnpm build:netlify` rewrites two blog images and generated data. Check `git status` before `git add -A`.
- `react-doctor` (`pnpm dlx react-doctor@latest . --verbose --diff`) is advisory, not a gate.

## Release notes (`content/updates/*.md`, format in `docs/UPDATE_FORMAT.md`)
- Every user-facing change ships with exactly one note per feature. It stays `status: draft` while the PR is open.
- After merge, publish it: `status: published`, the next `version`, and `published_at` set to the production deploy time (or the merge time).
  - Always before 23:00 UTC; later times display as the next day in CET.
  - Strictly after the previous release.
- Visible lines (`- [x] [Type] …`):
  - describe a clear user benefit, from the user's side;
  - contain no paths, symbols, endpoints or env keys.
- Internal lines use `- [ ] [Internal] …`.
- Start each line with an emoji that matches its content. Put highlights first and fixes after.

## Git, PRs and deploys
- Write PR bodies with `--body-file` or a heredoc, never escaped `\n`.
- Use `Closes #123` only for issues the PR really resolves. Tick issue checkboxes against the issue's own wording.
- State exactly what was verified. "Not bundled" is not "removed from package.json".
- After merging to `main`, confirm a production deploy of that commit reached `ready` on `travelflowapp`.
- Verify API behaviour on a deploy preview or production. CLI alias deploys (`--no-build --alias`) serve no edge functions, so `/api/*` returns the app shell.
- Preview-host Lighthouse LCP is unreliable (Netlify toolbar, referrer-restricted map key). Measure production or a local build (`node scripts/serve-built-site.mjs`).
- In a fresh worktree, run `pnpm worktree:sync-env` if `.env` or `.env.local` is missing.
