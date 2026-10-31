# TravelFlow

TravelFlow generates and manages travel itineraries. It runs on TanStack Start and TanStack Router with React 19, TypeScript and Vite, deployed to Netlify (native Start since v0.209.0, 2026-10-24).

Start with [the architecture guide](docs/TANSTACK_START_ARCHITECTURE.md) for route ownership and [Netlify operations](docs/NETLIFY_TANSTACK_START.md) for previews and deployment. The completed migration history and its measurements are in [the migration record](docs/archive/TANSTACK_START_MIGRATION.md) and `docs/performance/`.

## Working on the TanStack Start app

Use the native route tree as the starting point for new work.

| Question | Read / change |
| --- | --- |
| How are document, routes and features composed? | [Architecture and contribution guide](docs/TANSTACK_START_ARCHITECTURE.md) |
| Which routes/layouts exist? | `src/virtualRoutes.ts`, route definitions in `src/routes/`; do not edit generated `src/routeTree.gen.ts` |
| Where do data/access/loading rules belong? | Native `beforeLoad`, `loader`, `head`, pending/error boundaries; domain logic in `features/` |
| How are public, auth, creation, trip and admin areas isolated? | Architecture ownership table; `app/shell/` is for shared cross-cutting UI |
| How do locale, SSR resources and language navigation work? | [I18n workflow](docs/I18N_PAGE_WORKFLOW.md); native router resource hydration and document preference synchronization |
| How do I verify changes? | `pnpm typecheck` and `pnpm ci:local`; behavioral regression tests in `tests/`; first-load browser and offline checks in `e2e/` |
| How do previews, deployment and API parity work? | [Netlify guide](docs/NETLIFY_TANSTACK_START.md) |

Keep route files small: delegate reusable behavior to feature modules and compose
shared components. Do not add a second route registry, global speculative prefetch,
or pre-hydration download gates. Server requests get separate data/i18n instances;
never put user data into a shared prerender. Route guards supplement backend
permissions. Presentation hints must never become authenticated session authority.

Verify the first visible frame as well as the hydrated page: theme and consent must
not appear through delayed user-interaction handlers. Keep public account navigation
stable while session verification happens: use the shared Account entry, real links
and verified session capabilities. Static public HTML must not invent an identity.
Consent is server-rendered when undecided; its pre-paint script only resolves the
visibility of existing stored choices. Use the shared early-click bridge for controls
that can be pressed before hydration.

## Requirements

- Node.js 22 (see `.node-version`)
- pnpm 10+ (via Corepack)

## Local Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create your local env file:

```bash
cp .env.example .env.local
```

3. Add your API keys to `.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
# Optional provider adapters / benchmark tooling
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
# Optional provider request timeout tuning (ms)
# /api/ai/generate default: 35000 (kept below typical edge response timeout window)
AI_GENERATE_PROVIDER_TIMEOUT_MS=35000
# /api/internal/ai/benchmark worker default: 90000
# Values below 90000 are ignored (benchmark keeps a hard 90s minimum).
AI_BENCHMARK_PROVIDER_TIMEOUT_MS=90000
# Temporary internal API guard (admin benchmark endpoints)
TF_ADMIN_API_KEY=replace_with_a_long_random_secret
```

4. Start the app:

```bash
pnpm dev
```

Plain development does not establish Edge API parity. For internal edge API routes (for example `/api/internal/ai/benchmark`), use the Netlify wrapper:

```bash
pnpm dev:netlify
```

Open the port reported by Netlify (normally `http://localhost:8888`). Adapter Edge emulation is also available with `NETLIFY_DEV_EDGE=true pnpm dev`; verify API behavior on the actual deploy preview before claiming parity.

For async trip-generation worker parity and local troubleshooting, use:

- [docs/AI_TRIP_GENERATION_LOCAL_DEV.md](docs/AI_TRIP_GENERATION_LOCAL_DEV.md)

## Routes

- `/` marketing landing page
- `/es/*`, `/de/*`, `/fr/*`, `/pt/*`, `/ru/*`, `/it/*`, `/pl/*`, `/ko/*`, `/fa/*`, `/ur/*` localized marketing pages (English stays on root paths)
- `/create-trip` trip creation flow
- `/trip/:tripId` planner (owner/admin stays; non-owner viewers route to `/s/:token` when an active share exists; without share they are routed to login/share-unavailable)
- `/example/:templateId` example trip playground (ephemeral, non-persistent)
- `/s/:token` shared trip link
- `/updates` marketing updates feed from markdown release files
- `/admin/*` admin workspace (admins only). One shell with a sidebar grouped into Workspace, Operations, Content and Tools, a `⌘K` command palette that jumps to any screen, and breadcrumbs. Each screen's job, layout and columns are described in `docs/ADMIN_SCREENS.md`:
  - Workspace: `/admin/dashboard` (Overview), `/admin/settings` (app-wide settings)
  - Operations: `/admin/users`, `/admin/trips`, `/admin/tiers`, `/admin/billing`, `/admin/audit`
  - Content: `/admin/airports`, `/admin/destinations`, `/admin/recommendations`, `/admin/legal`
  - Tools: `/admin/ai-benchmark`, `/admin/ai-benchmark/telemetry`, `/admin/ai-benchmark/worker-health`, `/admin/og-tools`, `/admin/design-system-playground`
  - Unlisted: `/admin/component-playground` (noindex, reached by URL only)

## Admin security and isolation

- Admin UI has its own native pathless route area, browser rendering policy, access guard and leaf modules. Public and normal-user navigation must not preload admin page code.
- Browser bundles are publicly retrievable. No database secrets or service-role credentials may be shipped client-side; selective client rendering is not an authorization mechanism.
- Admin data access is enforced server-side via Supabase RLS + RPC permission checks (`has_admin_permission`) and edge authorization for privileged identity actions (`/api/internal/admin/iam`).
- Compatibility note: current RBAC includes a temporary fail-open path for legacy admins without explicit role rows; strict role-only enforcement is tracked in `docs/AUTH_ROLES_IMPLEMENTATION_NOTES.md`.

## I18n And Locale Routing Workflow

For adding new localized pages, route keys, SEO metadata, and translation resources, follow:

- `docs/I18N_PAGE_WORKFLOW.md`

## UX Writing And Copy Workflow

For marketing copy, CTA wording, planner microcopy, and localization/transcreation tone rules, follow:

- `docs/UX_COPY_GUIDELINES.md`

## UI and Brand Guidelines

For UI styling, component behavior, and accessibility standards, use:

- `docs/BRAND_CI_GUIDELINES.md`

## Tech Stack Overview

For a one-table overview of frameworks, hosting, data, AI, maps and testing, use:

- `docs/TECH_STACK.md`

## Paywall Guidelines

For trip lifecycle state handling, lock behavior, and paywall rules, use:

- `docs/PAYWALL_GUIDELINES.md`

## Supabase Setup And Troubleshooting

For DB-backed trips, history snapshots, sharing, and auth/RLS troubleshooting, use:

- `docs/SUPABASE_RUNBOOK.md`
- `docs/SHARE_USERFLOWS.md`

## Build

```bash
pnpm build:netlify
```

`pnpm build:netlify` is what Netlify runs (`netlify.toml`). It syncs flag assets, optimizes inspiration and blog images, builds image placeholders, PWA icons and static OG images, runs the repository validators, regenerates the sitemap, runs the Vite build, then `pnpm prerender:validate` and `pnpm pwa:sw`. `pnpm build` is the same pipeline with `pnpm test:core` first.

`pnpm prerender:validate` checks the seven public entry pages in every active locale after the native build, including canonical URLs and language/direction. The allowlist lives in `app/routing/publicPrerender.ts`; private routes must never enter it.

The build emits public assets and prerendered pages in `dist/client` and server output in `dist/server`. The Netlify adapter owns server deployment and document routing; uploading only static files is insufficient. See [the deployment guide](docs/NETLIFY_TANSTACK_START.md).

A manual build rewrites two blog images and some generated data. Check `git status` before `git add -A`.

Admin workspace screens are documented in `docs/ADMIN_SCREENS.md`; the visual contract is `docs/DESIGN.md` and the shared components are catalogued in `docs/DESIGN_SYSTEM_COMPONENTS.md`.

## Scripts

The full list is in `package.json`. The ones you will use most:

**Develop**
- `pnpm dev` — Start the TanStack Start dev server through Vite (syncs worktree env and flag assets first).
- `pnpm dev:netlify` — Run the app through Netlify Dev on port 8888 for edge/API parity.
- `pnpm preview` — Serve the built `dist/client` and `dist/server` output locally (`scripts/serve-built-site.mjs`).
- `pnpm worktree:new`, `pnpm worktree:sync-env`, `pnpm worktree:install-hooks` — Create a worktree, copy env files into it, install git hooks.

**Check and test**
- `pnpm typecheck` — Type-check the whole project (must stay at 0 errors).
- `pnpm ci:local` — Run the PR Quality stages locally (`--fast`, `--only=<stage>`, `--from=<stage>`, `--list`).
- `pnpm test` / `pnpm test:run` — Run the Vitest suite once. `pnpm test:watch` runs it in watch mode.
- `pnpm test:core` — Run Vitest with the coverage gate.
- `pnpm test:e2e`, `pnpm test:e2e:production`, `pnpm test:e2e:offline`, `pnpm test:e2e:pwa` — Playwright suites.
- `pnpm benchmark:runtime`, `pnpm benchmark:runtime:compare`, `pnpm benchmark:runtime:upgrade` — Local runtime benchmarks.
- `pnpm doctor` — Run react-doctor (advisory).

**Build**
- `pnpm build:netlify` — Production build used by Netlify.
- `pnpm build` — `test:core`, then the same pipeline.
- `pnpm release:prepare` — Generate missing blog images, then `pnpm build`.
- `pnpm prerender:validate` — Validate prerendered public documents after the Vite build.
- `pnpm pwa:icons`, `pnpm pwa:sw` — Build PWA icons and the service worker.
- `pnpm sitemap:generate` — Regenerate `public/sitemap.xml`.
- `pnpm og:site:build`, `pnpm og:site:validate` (and `:full` variants) — Build and validate static OG images.

**Validators** (all run inside the build)
- `pnpm i18n:validate`, `pnpm updates:validate` (`pnpm updates:fix`), `pnpm blog:validate`, `pnpm edge:validate`, `pnpm storage:validate`, `pnpm toasts:validate`, `pnpm supabase:validate`, `pnpm runtime-env:validate`, `pnpm plans:validate-sync`, `pnpm routes:validate`, `pnpm climate:validate`.
- `pnpm destinations:validate` — Validate destination guides (not part of the build).
- `pnpm supabase:check-main-sync` — Check that `docs/supabase.sql` is not behind `origin/main`.
- `pnpm darkmode:audit` — Audit dark-mode styling.

**Content and data**
- `pnpm updates:next-version` — Print the next release version.
- `pnpm build:images`, `pnpm inspirations:images:optimize`, `pnpm inspirations:images:jobs` — Inspiration images.
- `pnpm build:blog-images`, `pnpm blog:images:optimize`, `pnpm blog:images:jobs` — Blog images.
- `pnpm build:example-previews`, `pnpm build:image-placeholders`, `pnpm flags:sync` — Generated assets.
- `pnpm destinations:import`, `pnpm destinations:split`, `pnpm destinations:sync`, `pnpm destinations:sources:import` — Destination guide data (see `docs/DESTINATION_INGESTION_RUNBOOK.md`).
- `pnpm maps:generate`, `pnpm maps:routes:generate`, `pnpm routes:stops:resolve`, `pnpm countries:map:generate`, `pnpm countries:search:generate`, `pnpm climate:generate`, `pnpm airports:generate`, `pnpm trips:enrich-locations` — Generators for maps and reference data.
- `pnpm plans:generate-seed` — Generate `docs/plan-seed.generated.sql`.

**AI**
- `pnpm ai:eval`, `pnpm ai:eval:ci`, `pnpm ai:eval:security`, `pnpm ai:eval:security:ci` — Promptfoo evals (see `docs/PROMPTFOO_EVAL_WORKFLOW.md`).
- `pnpm trip-agent:dry-run` — Dry-run the Trip Agent with `.env.local`.

## Blog Image Workflow

When publishing a new blog post, run:

```bash
pnpm build:blog-images
```

This generates missing source images for published posts (card, header, vertical OG), then creates responsive `480/768/1024` WebP derivatives and compresses oversized blog assets.

## Inspiration Image Workflow

To generate missing inspiration source images, run:

```bash
pnpm build:images
```

This generates only missing source images and then creates responsive `480/768/1024` WebP derivatives while compressing oversized inspiration assets.

For a full pre-release workflow (generate missing blog images + run full validations/build):

```bash
pnpm release:prepare
```

## Generate Trip Map Images

The homepage trip cards display static route map PNGs. To regenerate them from current trip template coordinates:

```bash
pnpm maps:generate
```

The script reads `VITE_GOOGLE_MAPS_API_KEY` from `.env.local` (or `.env`) and downloads one PNG per template into `public/images/trip-maps/`.

Use `--dry-run` to preview the Google Static Maps URLs without downloading:

```bash
pnpm maps:generate -- --dry-run
```

Re-run this after adding new trip templates or changing city coordinates.

## Deploy to Netlify

TravelFlow deploys only to the Netlify project `travelflowapp` (site ID `1abc3d37-f6af-4810-9097-489b2a282ac6`, `https://travelflowapp.netlify.app`). Run `netlify status` before any manual deploy and stop unless it names `travelflowapp`. Previews, alias-deploy caveats and build diagnosis are in [docs/NETLIFY_TANSTACK_START.md](docs/NETLIFY_TANSTACK_START.md).

`netlify.toml` holds the configuration:
- Build command: `pnpm build:netlify`
- Publish directory: `dist/client`. Server output in `dist/server` is deployed by the TanStack Start Netlify adapter, which also owns document routing. There is no SPA rewrite.
- Edge functions in `netlify/edge-functions`, mapped to `/api/*` paths with `[[edge_functions]]` entries. Node functions (scheduled and background) live in `netlify/functions`.
- Node 22 via `NODE_VERSION`.

Production deploys from `main`; every PR gets a Deploy Preview. Optional: if your Netlify plan exposes custom Functions regions, set the default to `eu-west-2` (or the closest EU region) so scheduled/background functions stay close to the EU-hosted Supabase project. Edge functions remain globally distributed.

Netlify environment variables:
- `SITE_URL` (canonical public base URL for sitemap and absolute SEO URLs, e.g. `https://travelflowapp.netlify.app`)
- `GEMINI_API_KEY` (server-side key for `/api/ai/generate`; never expose it through a `VITE_*` variable — those are inlined into the public browser bundle)
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (required for `/api/internal/admin/iam` provisioning actions and AI telemetry persistence/reads)
- `OPENAI_API_KEY` (active for OpenAI models in `/api/ai/generate`)
- `ANTHROPIC_API_KEY` (active for Anthropic models in `/api/ai/generate`)
- `OPENROUTER_API_KEY` (active for curated OpenRouter models in `/api/ai/generate`)
- `TF_ADMIN_API_KEY` (required for internal benchmark API endpoints in deployed environments)

Sitemap behavior:
- `pnpm sitemap:generate` (`scripts/generate-sitemap.ts`) regenerates `public/sitemap.xml` during every build.
- The canonical sitemap host is read from `SITE_URL` (`VITE_SITE_URL` fallback) via `config/site-url.mjs`.
- Static URLs come from the indexable areas of the native route tree in `src/virtualRoutes.ts` (`collectIndexableRoutePaths` in `scripts/lib/sitemapRoutes.ts`).
- Utility/error routes that should stay out of search indexing go in `NON_INDEXABLE_PATHS` in `scripts/lib/sitemapRoutes.ts`.

`/admin/ai-benchmark` uses:
- the signed-in admin's Supabase bearer token: the edge function checks `system_role = 'admin'` via `get_current_user_access` and uses the same token for owner-scoped RLS writes
- `x-tf-admin-key` (`TF_ADMIN_API_KEY`) only as an emergency fallback, and only when `TF_ENABLE_ADMIN_KEY_FALLBACK` is enabled
- prompt preview generation from current benchmark form settings
- session export with optional log bundle (`/api/internal/ai/benchmark/export?session=<id>&includeLogs=1`)

## Dynamic Open Graph (Netlify Edge)

- Non-trip pages (home, features, updates, blog, legal pages, etc.) use a dedicated `/api/og/site` image generator with page title + subline, TravelFlow branding, and an accent-gradient hero.
- Shared links (`/s/:token`) use Netlify Edge Functions to inject route-specific Open Graph and Twitter meta tags into the HTML response.
- Direct trip links (`/trip/:tripId`) with an active share use share-backed OG metadata/images, and non-owner viewers are routed to the canonical shared route (`/s/:token`).
- OG images are generated at `/api/og/trip` with `og_edge` (Netlify-compatible `@vercel/og`), including:
  - trip title
  - weeks/months/total distance metrics
  - Google Static Maps route preview (matching tooltip map style)
  - TravelFlow branding + shared URL footer
- For shared links, OG map rendering can inherit shared view preferences when available:
  - `mapStyle` (`minimal`, `standard`, `dark`, `satellite`, `clean`)
  - `routeMode` (`simple`, `realistic`)
  - `showStops` (`true`/`false`) for stop/start-end marker rendering
  - `showCities` (`true`/`false`) for custom city-name labels near route points
- Query overrides can force map output for testing:
  - `mapStyle=<style>`
  - `routeMode=<simple|realistic>`
  - `showStops=1|0`
  - `showCities=1|0` (`cityNames=1|0` remains a legacy alias)
- The edge metadata function adds `u=<trip.updatedAt>` to `og:image` URLs for automatic cache busting after shared trip updates.
- No separate CDN setup is required; caching is handled with Netlify edge cache headers.

### Local testing

1. Run the app through Netlify (Edge Functions only run through Netlify Dev):
   ```bash
   pnpm dev:netlify
   ```
2. Open the playground:
   - `http://localhost:8888/api/og/playground`
3. Use either:
   - real shared data via `s=<share_token>` (and optional `v=<version_uuid>`)
   - or layout/map overrides (`title`, `weeks`, `months`, `distance`, `path`, `map`, `mapStyle`, `routeMode`, `showStops`, `showCities`) for rapid visual tuning.
4. For blog social previews, switch playground endpoint to **Site OG** and set:
   - `title`, `description`, `pill=BLOG`, `path=/blog/<slug>`
   - `blog_image=/images/blog/<slug>-og-vertical.jpg`
   - optional `blog_tint=#<hex>` + `blog_tint_intensity=<0-100>` (strict percent scale; blog pages default to accent tint at 60)
   - optional `blog_rev=<revision>` (cache-bust token; default comes from `data/blogImageMedia.ts`)
5. Use the admin inspector at `http://localhost:8888/admin/og-tools` to:
   - inspect same-origin route metadata (`canonical`, `og:*`, `twitter:*`)
   - verify static vs dynamic OG source mode (`x-travelflow-og-source`)
   - build filtered static OG generation commands

Filtered static OG generation examples:
- `pnpm og:site:build -- --locales=en,de --include-prefixes=/blog,/de/blog`
- `pnpm og:site:build -- --exclude-prefixes=/example`

Default static OG scope (fast path):
- localized home (`/` + locale homes)
- localized blog overview (`/blog`)
- localized inspirations overview (`/inspirations`)
- `/example/*` templates
- Note: `/example/*` keeps runtime trip-card OG rendering for visual parity with shared trip previews.

Release-safe default verification:
- `pnpm og:site:build && pnpm og:site:validate`

Full static coverage override (all supported static/detail routes):
- `pnpm og:site:build:full && pnpm og:site:validate:full`

Faster local builds (skip static OG generation/validation):
- `SITE_OG_STATIC_BUILD_MODE=skip pnpm build:netlify`
- `SITE_OG_STATIC_BUILD_MODE=full pnpm build:netlify` (force full local parity)

Example direct image URL:
`http://localhost:8888/api/og/trip?s=demo-share&title=Japan%20Spring%20Loop&mapStyle=clean&routeMode=realistic&showStops=1&showCities=1`

Example non-trip image URL:
`http://localhost:8888/api/og/site?title=Features&description=See%20everything%20TravelFlow%20can%20do&path=/features`

Example blog image URL:
`http://localhost:8888/api/og/site?title=How%20to%20Plan%20the%20Perfect%20Multi-City%20Trip&description=Plan%20a%20smooth%20multi-stop%20itinerary%20with%20smart%20routing%2C%20realistic%20timing%2C%20and%20less%20stress.&path=/blog/how-to-plan-multi-city-trip&pill=BLOG&blog_image=/images/blog/how-to-plan-multi-city-trip-og-vertical.jpg&blog_rev=2026-02-10-01`

## Create The GitHub Repo (CLI)

If GitHub CLI is authenticated, run:

```bash
gh repo create travelflow --source=. --remote=origin --public --push
```

Use `--private` instead of `--public` if you want a private repo.
