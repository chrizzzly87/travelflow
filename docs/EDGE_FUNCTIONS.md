# Edge Functions

All Netlify Edge Functions live in `netlify/edge-functions/`.
Shared helpers live in `netlify/edge-lib/`.

## Inventory

| Function file | Route(s) | Purpose | Type |
|---|---|---|---|
| `ai-generate.ts` | `/api/ai/generate` | Server-side AI itinerary generation endpoint (Gemini, OpenAI, Anthropic, OpenRouter allowlisted models) | API |
| `ai-benchmark.ts` | `/api/internal/ai/benchmark`, `/api/internal/ai/benchmark/export`, `/api/internal/ai/benchmark/cleanup`, `/api/internal/ai/benchmark/rating`, `/api/internal/ai/benchmark/telemetry`, `/api/internal/ai/benchmark/preferences` | Internal benchmark API (session/run persistence, execution, export, cleanup, persisted run ratings, telemetry summaries, and admin preference persistence for benchmark model targets/presets) with bearer-token admin role enforcement (`get_current_user_access`). Session export supports `includeLogs=1` to bundle prompt/scenario + run logs. | API |
| `admin-iam.ts` | `/api/internal/admin/iam` | Internal admin identity API for invite/direct user provisioning and hard-delete actions via Supabase Auth admin endpoints. | API |
| `site-og-meta.ts` | Explicit static+localized allowlist in `netlify.toml` (home, marketing pages, legal pages, `/create-trip`, `/example/*`, localized variants) | Injects SEO & Open Graph meta tags with static-first OG image lookup and dynamic fallback | Middleware |
| `site-og-image.tsx` | `/api/og/site` | Generates 1200x630 branded OG images for site pages | Image generator |
| `trip-og-meta.ts` | `/s/*`, `/trip/*` | Injects OG meta tags for shared and private trip pages | Middleware |
| `trip-og-image.tsx` | `/api/og/trip` | Generates dynamic OG images showing trip route, duration, distance | Image generator |
| `trip-og-playground.ts` | `/api/og/playground` | Dev tool — interactive UI to preview trip/site OG image endpoints directly | Dev tool |
| `trip-map-preview.ts` | `/api/trip-map-preview` | Proxies Google Static Maps API; returns 302 redirect to styled map | API proxy |
| `trip-share-resolve.ts` | `/api/trip-share-resolve` | Resolves active share token by trip id for non-owner route handoff | API |

**Shared helper:** `netlify/edge-lib/trip-og-data.ts` — Supabase RPC calls, HTML escaping, URL builders, map API key access.

## Architecture

```
Blog pages ──▶ site-og-meta.ts ──context.next()──▶ SPA index.html
                         │
                         ├─▶ static OG manifest lookup (`/images/og/site/generated/manifest.json`)
                         │         │
                         │         └─▶ `/images/og/site/generated/*.png` (preferred)
                         │
                         └─▶ fallback OG URL (`/api/og/site?...`) when no static match

Example template pages (`/example/*`) ──▶ site-og-meta.ts ──▶ force dynamic OG (`/api/og/trip?...`)
                         │
                         └─▶ skips static-site manifest so example previews match trip/share card layout

Trip/share pages ──▶ trip-og-meta.ts ──context.next()──▶ SPA index.html
                         │
                         ▼ (OG image URL points to)
                    trip-og-image.tsx

/api/trip-map-preview ──▶ trip-map-preview.ts ──302──▶ Google Static Maps
/api/trip-share-resolve ──▶ trip-share-resolve.ts ──JSON──▶ share token + canonical /s path
```

- **Middleware functions** (`*-meta.ts`) call `context.next()` to get the SPA HTML, then rewrite `<head>` tags before returning the response.
- **Image generators** (`*-image.tsx`) return standalone `ImageResponse` objects (server-rendered React → PNG).
- **API proxies** (`trip-map-preview.ts`) return redirects or direct responses; no middleware chaining.

## Configuration rules

> **All routes MUST be declared in `netlify.toml` only.**
>
> Never use inline `export const config = { path: "..." }` in edge function files.
> Mixing inline config with `netlify.toml` config crashes the entire edge function bundle at runtime, producing **500 errors on every page**.

The CI validator (`scripts/validate-edge-functions.mjs`) enforces this rule at build time.

### Catch-all route policy

- Do not add `[[edge_functions]] path = "/*"` in `netlify.toml`.
- Catch-all edge bindings are treated as a production availability risk because upstream timeouts can convert into full-site `502` incidents.
- Use explicit path allowlists (for example: `/`, `/blog`, `/blog/*`, `/api/og/*`) and keep static/internal platform paths outside edge middleware.
- CI fails if a catch-all edge binding is added.

### Site metadata scope policy

- `site-og-meta` must only be mapped to the explicit static/example allowlist in `netlify.toml`.
- Allowed groups: `/`, static marketing pages, legal pages, `/blog*`, `/inspirations*`, `/create-trip`, `/example/*`, and locale-prefixed variants for active locales.
- Forbidden: catch-all patterns, admin/profile/api routes, or broad locale catch-alls (for example `/de/*`).
- CI fails if `site-og-meta` is configured outside the approved allowlist.

## Static OG build workflow

- Build-time generator: `pnpm og:site:build`
  - Enumerates static OG targets from the shared metadata resolver.
  - Writes hashed PNG assets to `public/images/og/site/generated/`.
  - Writes `public/images/og/site/generated/manifest.json`.
  - Supports optional route filters:
    - `--locales=en,de`
    - `--include-paths=/,/blog`
    - `--include-prefixes=/blog,/de/blog`
    - `--exclude-paths=/blog/draft-slug`
    - `--exclude-prefixes=/example`
  - When `--locales` is set, include/exclude path filters may use base paths (for example `--locales=fa --include-paths=/blog` targets `/fa/blog`).
  - Filtered runs that resolve only to dynamic OG routes (for example RTL locales that stay edge-rendered) exit successfully without writing static files.
- Netlify build-cache plugin: `./netlify/plugins/site-og-build-cache`
  - Restores `public/images/og/site/generated/` before `pnpm og:site:build`.
  - Saves `public/images/og/site/generated/` after successful builds.
  - Enables hash-based reuse across CI builds so unchanged static OG assets are not re-rendered.
- Validator: `pnpm og:site:validate`
  - Verifies full route coverage from resolver source.
  - Verifies hash/path determinism and on-disk asset existence.
- Build integration:
  - `pnpm build` runs `og:site:build` and `og:site:validate` before `vite build`.
- Build mode policy:
  - GitHub pull-request CI runs auto-skip static OG build/validation to keep PR checks fast.
  - Netlify non-production contexts (`deploy-preview`, `branch-deploy`, `dev`) auto-skip static OG build/validation to reduce preview deploy time.
  - Netlify production context keeps full static OG build + validation enabled.
  - Manual override: set `SITE_OG_STATIC_BUILD_MODE=full` to force generation, or `SITE_OG_STATIC_BUILD_MODE=skip` to bypass locally.
- Generated assets are build artifacts and are intentionally not committed.
- Filtered runs update only selected route keys and preserve existing manifest entries for all other routes.

### When adding locales or pages

- If you add a new locale, static route, blog route, country inspiration route, or example template route that should have static OG coverage:
  1. Update the shared resolver inputs (`netlify/edge-lib/site-og-metadata.ts` and related data sources).
  2. Run `pnpm og:site:build`.
  3. Run `pnpm og:site:validate`.
- Use `pnpm og:site:build` + `pnpm og:site:validate` for fast OG-only iteration.
- Use full `pnpm build` when you need complete release parity checks (i18n, storage registry, edge validation, sitemap, app bundle).
- In Netlify CI, the site-og build-cache plugin restores previous generated assets before `og:site:build`, so unchanged routes are typically reused and only changed/new routes are rendered.

## Admin OG tooling

- Admin route: `/admin/og-tools`
- Capabilities:
  - Same-origin URL inspector for rendered `<head>` metadata (`canonical`, `og:*`, `twitter:*`) and `x-travelflow-og-source`.
  - OG image source classification (`static-generated`, `dynamic-site`, `dynamic-trip`).
  - Command builder for filtered `pnpm og:site:build -- ...` runs plus validation command output.
- Use this page for operational checks before sharing social links, then run full release-safe build validation before deploys.

## Required environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | `trip-map-preview.ts`, `trip-og-image.tsx`, `trip-og-meta.ts` (via `trip-og-data.ts`) | Google Static Maps API access |
| `VITE_SUPABASE_URL` | `trip-og-meta.ts`, `trip-og-image.tsx`, `trip-share-resolve.ts` (via `trip-og-data.ts`) | Supabase REST API base URL |
| `VITE_SUPABASE_ANON_KEY` | `trip-og-meta.ts`, `trip-og-image.tsx`, `trip-share-resolve.ts` (via `trip-og-data.ts`) | Supabase anonymous auth key for shared-trip RPC reads |
| `SUPABASE_SERVICE_ROLE_KEY` | `trip-og-meta.ts`, `trip-og-image.tsx`, `trip-share-resolve.ts` (via `trip-og-data.ts`), `admin-iam.ts`, `ai-generate.ts`, `ai-benchmark.ts` | Service-role access for shared-trip resolution, Auth Admin actions, and internal AI telemetry writes/reads |
| `GEMINI_API_KEY` | `ai-generate.ts` | Preferred server-side Gemini key for `/api/ai/generate` |
| `VITE_GEMINI_API_KEY` | `ai-generate.ts` (fallback), legacy browser path | Compatibility fallback if `GEMINI_API_KEY` is not set |
| `TF_ADMIN_API_KEY` | `ai-benchmark.ts` | Emergency fallback key for internal benchmark endpoints when `TF_ENABLE_ADMIN_KEY_FALLBACK` is enabled |
| `TF_ENABLE_ADMIN_KEY_FALLBACK` | `ai-benchmark.ts` | Enables optional `x-tf-admin-key` fallback auth path (disabled by default) |
| `VITE_SUPABASE_URL` | `ai-benchmark.ts` | Supabase REST URL used for benchmark session/run/trip persistence |
| `VITE_SUPABASE_ANON_KEY` | `ai-benchmark.ts` | Supabase REST anon key used with caller bearer token for owner-scoped RLS access |
| `VITE_SUPABASE_URL` | `admin-iam.ts` | Supabase project URL used for Auth and REST calls |
| `VITE_SUPABASE_ANON_KEY` | `admin-iam.ts` | Supabase anon key used with caller bearer token for admin-role verification RPC |
| `OPENAI_API_KEY` | `ai-generate.ts` | Server-side key for OpenAI model execution in `/api/ai/generate` |
| `ANTHROPIC_API_KEY` | `ai-generate.ts` | Server-side key for Anthropic model execution in `/api/ai/generate` |
| `OPENROUTER_API_KEY` | `ai-generate.ts` | Server-side key for curated OpenRouter model execution in `/api/ai/generate` |

Set required keys in **Netlify > Site settings > Environment variables**. Key names used in source are also listed in `SECRETS_SCAN_OMIT_KEYS` in `netlify.toml` to suppress Netlify's secret scanner false positives.

## External dependencies (Deno CDN imports)

| Import | Used by | Pinned version |
|---|---|---|
| `https://esm.sh/react@18.3.1` | `site-og-image.tsx`, `trip-og-image.tsx` | 18.3.1 |
| `https://deno.land/x/og_edge/mod.ts` | `site-og-image.tsx`, `trip-og-image.tsx` | latest (unpinned) |

### OG font dependency policy

- OG image functions must load heading fonts from local assets only (`/fonts/bricolage-grotesque/*` for LTR and `/fonts/vazirmatn/*` for RTL Persian/Urdu rendering).
- Do not add remote CDN font fallbacks in edge image functions.
- Font fetch operations must stay short-lived (timeout bounded) so upstream slowness does not turn into edge 502s.

## Caching strategies

| Function | Cache-Control | Notes |
|---|---|---|
| `site-og-meta.ts` | `s-maxage=900, stale-while-revalidate=86400` | 15 min CDN, 1 day stale |
| `site-og-image.tsx` | `s-maxage=43200, stale-while-revalidate=604800` | 12 hour CDN, 7 day stale |
| `/images/og/site/generated/*` | `max-age=31536000, immutable` | Build-time generated static OG assets |
| `trip-og-meta.ts` (shared) | `s-maxage=300, stale-while-revalidate=86400` | 5 min CDN, 1 day stale |
| `trip-og-meta.ts` (private) | `s-maxage=120, stale-while-revalidate=3600` | 2 min CDN, 1 hour stale |
| `trip-og-image.tsx` (versioned) | `s-maxage=31536000` | 1 year immutable |
| `trip-og-image.tsx` (default) | `s-maxage=1800, stale-while-revalidate=86400` | 30 min CDN, 1 day stale |
| `trip-map-preview.ts` | `max-age=86400` | 24 hour browser + CDN |
| `trip-og-playground.ts` | `no-store` | Dev tool, never cached |

All CDN-cached functions use `max-age=0` for browser to always revalidate with the CDN.

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| **500 on every page** | Mixed config: inline `export const config` + `netlify.toml` routes | Remove inline config; routes go in `netlify.toml` only |
| **500 on OG image endpoints** | Deno CDN import failure (`esm.sh`, `deno.land/x`) | Retry deploy; consider pinning `og_edge` version |
| **Blank/generic OG previews** | Missing `VITE_GOOGLE_MAPS_API_KEY` or Supabase env vars | Set env vars in Netlify dashboard |
| **Trip OG shows fallback card** | Supabase RPC returns null (trip deleted or token invalid) | Expected behavior — fallback is intentional |
| **Direct `/trip/...` links show generic previews** | Missing `SUPABASE_SERVICE_ROLE_KEY` prevents active-share lookup by trip ID | Set `SUPABASE_SERVICE_ROLE_KEY` so trip routes can resolve share-backed OG data |
| **Stale social previews** | CDN cache not yet expired | Append `?v=2` to force refetch, or purge via Netlify dashboard |
