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
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

4. Start the app:

```bash
npm run dev
```

## Routes

- `/` marketing landing page
- `/create-trip` trip creation flow
- `/trip/:tripId` planner
- `/example/:templateId` example trip playground (ephemeral, non-persistent)
- `/s/:token` shared trip link
- `/updates` marketing updates feed from markdown release files
- `/admin/dashboard` admin metrics placeholder (future role-gated)

## UI and Brand Guidelines

For UI styling, component behavior, and accessibility standards, use:

- `/Users/chrizzzly/.codex/worktrees/6621/travelflow-codex/docs/BRAND_CI_GUIDELINES.md`

## Paywall Guidelines

For trip lifecycle state handling, lock behavior, and paywall rules, use:

- `/Users/chrizzzly/.codex/worktrees/6621/travelflow-codex/docs/PAYWALL_GUIDELINES.md`

## Supabase Setup And Troubleshooting

For DB-backed trips, history snapshots, sharing, and auth/RLS troubleshooting, use:

- `/Users/chrizzzly/.codex/worktrees/7b0e/travelflow-codex/docs/SUPABASE_RUNBOOK.md`

## Build

```bash
npm run build
```

The production output is generated in `dist/`.

`npm run build` includes release-note validation (`npm run updates:validate`) for `content/updates/*.md`.

Admin dashboard planning scope is documented in `docs/ADMIN_DASHBOARD_PLAN.md`.

## Blog Image Workflow

When publishing a new blog post, run:

```bash
npm run build:blog-images
```

This only generates missing image variants for published posts (card, header, vertical OG) and leaves existing blog images untouched.

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
   - `VITE_GEMINI_API_KEY`
   - `VITE_GOOGLE_MAPS_API_KEY`
4. Deploy.

## Deploy To Netlify

This repo includes `netlify.toml` for build settings + SPA redirects.

1. Push this repo to GitHub.
2. In Netlify, create a new site from Git.
3. Confirm build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. In Netlify environment variables, add:
   - `VITE_GEMINI_API_KEY`
   - `VITE_GOOGLE_MAPS_API_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy.

## Dynamic Open Graph (Netlify Edge)

- Non-trip pages (home, features, updates, blog, legal pages, etc.) use a dedicated `/api/og/site` image generator with page title + subline, TravelFlow branding, and an accent-gradient hero.
- Shared links (`/s/:token`) use Netlify Edge Functions to inject route-specific Open Graph and Twitter meta tags into the HTML response.
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
