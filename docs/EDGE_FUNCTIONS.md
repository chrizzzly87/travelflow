# Edge Functions

All Netlify Edge Functions live in `netlify/edge-functions/`.
Shared helpers live in `netlify/edge-lib/`.

## Inventory

| Function file | Route(s) | Purpose | Type |
|---|---|---|---|
| `ai-generate.ts` | `/api/ai/generate` | Server-side AI itinerary generation endpoint (Gemini, OpenAI, Anthropic allowlisted models) | API |
| `ai-benchmark.ts` | `/api/internal/ai/benchmark`, `/api/internal/ai/benchmark/export`, `/api/internal/ai/benchmark/cleanup`, `/api/internal/ai/benchmark/rating` | Internal benchmark API (session/run persistence, execution, export, cleanup, persisted run ratings) with bearer-token admin role enforcement (`get_current_user_access`). Session export supports `includeLogs=1` to bundle prompt/scenario + run logs. | API |
| `admin-iam.ts` | `/api/internal/admin/iam` | Internal admin identity API for invite/direct user provisioning and hard-delete actions via Supabase Auth admin endpoints. | API |
| `site-og-meta.ts` | `/`, `/create-trip`, `/features`, `/updates`, `/blog`, `/blog/*`, `/login`, `/imprint`, `/privacy`, `/terms`, `/cookies`, `/inspirations`, `/inspirations/*`, `/pricing`, `/admin/*` | Injects SEO & Open Graph meta tags into marketing page HTML | Middleware |
| `site-og-image.tsx` | `/api/og/site` | Generates 1200x630 branded OG images for site pages | Image generator |
| `trip-og-meta.ts` | `/s/*`, `/trip/*` | Injects OG meta tags for shared and private trip pages | Middleware |
| `trip-og-image.tsx` | `/api/og/trip` | Generates dynamic OG images showing trip route, duration, distance | Image generator |
| `trip-og-playground.ts` | `/api/og/playground` | Dev tool — interactive UI to preview trip OG images | Dev tool |
| `trip-map-preview.ts` | `/api/trip-map-preview` | Proxies Google Static Maps API; returns 302 redirect to styled map | API proxy |
| `trip-share-resolve.ts` | `/api/trip-share-resolve` | Resolves active share token by trip id for non-owner route handoff | API |

**Shared helper:** `netlify/edge-lib/trip-og-data.ts` — Supabase RPC calls, HTML escaping, URL builders, map API key access.

## Architecture

```
Marketing pages ──▶ site-og-meta.ts ──context.next()──▶ SPA index.html
                         │
                         ▼ (OG image URL points to)
                    site-og-image.tsx

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

## Required environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | `trip-map-preview.ts`, `trip-og-image.tsx`, `trip-og-meta.ts` (via `trip-og-data.ts`) | Google Static Maps API access |
| `VITE_SUPABASE_URL` | `trip-og-meta.ts`, `trip-og-image.tsx`, `trip-share-resolve.ts` (via `trip-og-data.ts`) | Supabase REST API base URL |
| `VITE_SUPABASE_ANON_KEY` | `trip-og-meta.ts`, `trip-og-image.tsx`, `trip-share-resolve.ts` (via `trip-og-data.ts`) | Supabase anonymous auth key for shared-trip RPC reads |
| `SUPABASE_SERVICE_ROLE_KEY` | `trip-og-meta.ts`, `trip-og-image.tsx`, `trip-share-resolve.ts` (via `trip-og-data.ts`) | Server-side lookup of active share tokens for trip-id based shared-route resolution |
| `GEMINI_API_KEY` | `ai-generate.ts` | Preferred server-side Gemini key for `/api/ai/generate` |
| `VITE_GEMINI_API_KEY` | `ai-generate.ts` (fallback), legacy browser path | Compatibility fallback if `GEMINI_API_KEY` is not set |
| `TF_ADMIN_API_KEY` | `ai-benchmark.ts` | Emergency fallback key for internal benchmark endpoints when `TF_ENABLE_ADMIN_KEY_FALLBACK` is enabled |
| `TF_ENABLE_ADMIN_KEY_FALLBACK` | `ai-benchmark.ts` | Enables optional `x-tf-admin-key` fallback auth path (disabled by default) |
| `VITE_SUPABASE_URL` | `ai-benchmark.ts` | Supabase REST URL used for benchmark session/run/trip persistence |
| `VITE_SUPABASE_ANON_KEY` | `ai-benchmark.ts` | Supabase REST anon key used with caller bearer token for owner-scoped RLS access |
| `SUPABASE_SERVICE_ROLE_KEY` | `admin-iam.ts` | Supabase service-role key used to call Auth Admin endpoints (create/invite/delete users) |
| `VITE_SUPABASE_URL` | `admin-iam.ts` | Supabase project URL used for Auth and REST calls |
| `VITE_SUPABASE_ANON_KEY` | `admin-iam.ts` | Supabase anon key used with caller bearer token for admin-role verification RPC |
| `OPENAI_API_KEY` | `ai-generate.ts` | Server-side key for OpenAI model execution in `/api/ai/generate` |
| `ANTHROPIC_API_KEY` | `ai-generate.ts` | Server-side key for Anthropic model execution in `/api/ai/generate` |
| `OPENROUTER_API_KEY` | future benchmark/provider adapter | Reserved for planned OpenRouter backend adapter |

Set required keys in **Netlify > Site settings > Environment variables**. Key names used in source are also listed in `SECRETS_SCAN_OMIT_KEYS` in `netlify.toml` to suppress Netlify's secret scanner false positives.

## External dependencies (Deno CDN imports)

| Import | Used by | Pinned version |
|---|---|---|
| `https://esm.sh/react@18.3.1` | `site-og-image.tsx`, `trip-og-image.tsx` | 18.3.1 |
| `https://deno.land/x/og_edge/mod.ts` | `site-og-image.tsx`, `trip-og-image.tsx` | latest (unpinned) |
| Space Grotesk font via `cdn.jsdelivr.net` | `site-og-image.tsx`, `trip-og-image.tsx` | — |

## Caching strategies

| Function | Cache-Control | Notes |
|---|---|---|
| `site-og-meta.ts` | `s-maxage=900, stale-while-revalidate=86400` | 15 min CDN, 1 day stale |
| `site-og-image.tsx` | `s-maxage=43200, stale-while-revalidate=604800` | 12 hour CDN, 7 day stale |
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
