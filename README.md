# TravelFlow

TravelFlow is a React + TypeScript + Vite app for generating and managing travel itineraries.

## Requirements

- Node.js 18+
- npm

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create your local env file:

```bash
cp .env.example .env.local
```

3. Add your API keys to `.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
# Optional local fallback (browser-side Gemini path for non-Netlify dev)
VITE_GEMINI_API_KEY=your_gemini_api_key_here
# Future provider adapters / benchmark tooling
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
npm run dev
```

For internal edge API routes (for example `/api/internal/ai/benchmark`), run Netlify dev instead:

```bash
npx netlify dev
```

Then open the app via `http://localhost:8888` so `/api/*` routes are handled by Netlify Edge Functions.

## Routes

- `/` marketing landing page
- `/es/*`, `/de/*`, `/fr/*`, `/pt/*`, `/ru/*`, `/it/*`, `/pl/*`, `/ko/*` localized marketing pages (English stays on root paths)
- `/create-trip` trip creation flow
- `/trip/:tripId` planner (owner/admin stays; non-owner viewers route to `/s/:token` when an active share exists; without share they are routed to login/share-unavailable)
- `/example/:templateId` example trip playground (ephemeral, non-persistent)
- `/s/:token` shared trip link
- `/updates` marketing updates feed from markdown release files
- `/admin/dashboard` admin operational overview
- `/admin/users` admin user provisioning and profile management
- `/admin/trips` admin trip lifecycle controls
- `/admin/tiers` admin entitlement template controls
- `/admin/audit` admin action audit timeline
- `/admin/ai-benchmark` internal AI benchmark workspace (classic input + multi-model runs + persisted session table + persisted run ranking)

## Admin security and isolation

- Admin UI is route-isolated behind `/admin/*` and lazy-loaded as a separate workspace router, so public and normal-user routes do not preload admin page code.
- Browser bundles are always publicly retrievable in any SPA deployment, so no database secrets or service-role credentials are shipped client-side.
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

## Paywall Guidelines

For trip lifecycle state handling, lock behavior, and paywall rules, use:

- `docs/PAYWALL_GUIDELINES.md`

## Supabase Setup And Troubleshooting

For DB-backed trips, history snapshots, sharing, and auth/RLS troubleshooting, use:

- `docs/SUPABASE_RUNBOOK.md`
- `docs/SHARE_USERFLOWS.md`

## Build

```bash
npm run build
```

The production output is generated in `dist/`.

`npm run build` now also runs build-time image optimization for inspirations + blog (responsive derivatives + compression) before validations and Vite bundling.

Admin dashboard planning scope is documented in `docs/ADMIN_DASHBOARD_PLAN.md`.

## NPM Scripts

All available `npm run` commands in this repo:

- `npm run dev` — Start Vite dev server.
- `npm run build` — Run image optimization (inspirations + blog), validations, and production Vite build.
- `npm run preview` — Preview the production build locally.
- `npm run release:prepare` — Generate missing blog source images, then run the full production build pipeline.
- `npm run updates:validate` — Validate `content/updates/*.md` formatting and release metadata.
- `npm run blog:validate` — Validate blog markdown metadata/content.
- `npm run edge:validate` — Validate Netlify edge function setup and constraints.
- `npm run maps:generate` — Generate static trip map PNGs from template coordinates.
- `npm run build:images` — Generate missing inspiration source images, then create responsive derivatives and optimize oversized assets.
- `npm run inspirations:images:optimize` — Optimize inspiration images only (`--skip-generation`).
- `npm run inspirations:images:jobs` — Build inspiration image batch job file only.
- `npm run build:blog-images` — Generate missing blog source images, then create responsive derivatives and optimize oversized assets.
- `npm run blog:images:optimize` — Optimize blog images only (`--skip-generation`).
- `npm run blog:images:jobs` — Build blog image batch job file only.

## Blog Image Workflow

When publishing a new blog post, run:

```bash
npm run build:blog-images
```

This generates missing source images for published posts (card, header, vertical OG), then creates responsive `480/768/1024` WebP derivatives and compresses oversized blog assets.

## Inspiration Image Workflow

To generate missing inspiration source images, run:

```bash
npm run build:images
```

This generates only missing source images and then creates responsive `480/768/1024` WebP derivatives while compressing oversized inspiration assets.

For a full pre-release workflow (generate missing blog images + run full validations/build):

```bash
npm run release:prepare
```

## Generate Trip Map Images

The homepage trip cards display static route map PNGs. To regenerate them from current trip template coordinates:

```bash
npm run maps:generate
```

The script reads `VITE_GOOGLE_MAPS_API_KEY` from `.env.local` (or `.env`) and downloads one PNG per template into `public/images/trip-maps/`.

Use `--dry-run` to preview the Google Static Maps URLs without downloading:

```bash
npm run maps:generate -- --dry-run
```

Re-run this after adding new trip templates or changing city coordinates.

## Deploy To Vercel

This repo includes `vercel.json` for Vite + SPA routing.

1. Push this repo to GitHub.
2. In Vercel, import the GitHub repository.
3. In Vercel project settings, add:
   - `GEMINI_API_KEY` (server-side generation)
   - `VITE_GOOGLE_MAPS_API_KEY`
   - `TF_ADMIN_API_KEY` (for internal benchmark API routes)
4. Deploy.

## Deploy To Netlify

This repo includes `netlify.toml` for build settings + SPA redirects.
For branch/PR preview workflow and caveats, see `docs/NETLIFY_FEATURE_BRANCH_DEPLOY.md`.

1. Push this repo to GitHub.
2. In Netlify, create a new site from Git.
3. Confirm build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. In Netlify environment variables, add:
   - `SITE_URL` (canonical public base URL for sitemap and absolute SEO URLs, e.g. `https://travelflowapp.netlify.app`)
   - `GEMINI_API_KEY` (preferred server-side key for `/api/ai/generate`)
   - `VITE_GEMINI_API_KEY` (optional browser fallback for local/dev compatibility)
   - `VITE_GOOGLE_MAPS_API_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (required for `/api/internal/admin/iam` provisioning actions)
   - `OPENAI_API_KEY` (active for OpenAI models in `/api/ai/generate`)
   - `ANTHROPIC_API_KEY` (active for Anthropic models in `/api/ai/generate`)
   - `OPENROUTER_API_KEY` (reserved for upcoming OpenRouter adapter)
   - `TF_ADMIN_API_KEY` (required for internal benchmark API endpoints in deployed environments)
5. Deploy.

Sitemap behavior:
- `npm run build` regenerates `public/sitemap.xml` on every deploy.
- The canonical sitemap host is read from `SITE_URL` (`VITE_SITE_URL` fallback) via `config/site-url.mjs`.
- Static marketing URLs are derived from `MARKETING_ROUTE_CONFIGS` in `App.tsx`.
- Utility/error routes that should stay out of search indexing must be listed in `NON_INDEXABLE_STATIC_PATHS` in `scripts/generate-sitemap.mjs`.

`/admin/ai-benchmark` uses:
- temporary simulated-login UI gate (debug mode)
- `x-tf-admin-key` request header (from your entered `TF_ADMIN_API_KEY`)
- Supabase bearer token from current session for owner-scoped RLS writes
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
   npx netlify dev
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
