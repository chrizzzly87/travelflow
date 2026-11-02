# TanStack Start on Netlify

How the production TanStack Start build deploys to Netlify. The completed migration
history is in [archive/TANSTACK_START_MIGRATION.md](archive/TANSTACK_START_MIGRATION.md).

## Project identity

Before any deploy, verify the current repository remote and its linked Netlify site.
TravelFlow's expected repository is `chrizzzly87/travelflow`, site `travelflowapp`,
site ID `1abc3d37-f6af-4810-9097-489b2a282ac6`. Do not reuse another repository's
project linkage. Review changes on a PR deploy preview. Do not deploy a feature
branch directly to production.

## Build ownership

- Node 22 comes from `.node-version` and `netlify.toml`; pnpm is pinned in `package.json`.
- `pnpm build:netlify` prepares assets, runs repository validators, invokes the Start
  Vite build, validates emitted public documents, then generates the service worker. `pnpm build` also runs core tests.
- `@netlify/vite-plugin-tanstack-start` adapts server rendering to Netlify. Keep the
  plugin alongside the Start and React plugins in `vite.config.ts`.
- Publish `dist/client`. Client assets and prerendered public documents live there;
  server output lives in `dist/server` and adapter-generated deployment artifacts.
  Do not copy server output into the public directory or deploy only static files.
- The adapter owns document routing. Do not restore a blanket `/* /spa.html 200`
  rewrite: it bypasses dynamic SSR, status codes and native route decisions.
- Keep existing explicitly configured API/image Edge Functions. HTML metadata
  rewriting bindings have been removed; the Start document owns its head.

The Start SPA-shell configuration uses a separate mask path and emits the offline
shell consumed by `scripts/build-service-worker.mjs`. Check that the shell actually
exists before generating a worker. See [offline operations](PWA_OFFLINE.md).

## Public document output

Use the native Start prerender allowlist in `app/routing/publicPrerender.ts`: seven
public entry points across all active locales. Keep canonical slugs English and
locale support prefix-only. Native flat output emits `index.html`, `features.html`,
`de.html` and `de/features.html`; do not add competing `features/index.html` files.
Directory indexes make Netlify normalize a slashless link through an extra redirect.

`pnpm prerender:validate` runs after Vite in both build commands. It checks actual
artifacts for language, direction, canonical path and server-rendered heading, and
rejects stale directory indexes. Session-bound documents are never prerender targets.
Other public pages retain on-demand SSR. The separate `spa.html` remains the PWA
fallback; increasing public prerenders must not expand service-worker precaching.

Verify canonical public URLs on the actual preview: successful status with no
redirect, including localized roots and RTL pages. Local flat-file serving alone
cannot prove Netlify URL normalization. Compare document TTFB and redirect count
separately from browser JavaScript/image loading, against an immutable prior deploy.

## Local development and preview

`pnpm dev` runs Start through Vite. Edge emulation in the adapter is opt-in via
`NETLIFY_DEV_EDGE=true`; API routes needing that runtime cannot be validated by a
plain frontend-only run. The existing `pnpm dev:netlify` wrapper remains available
for Netlify API parity; verify the served port and avoid competing local servers.

For built browser tests, use `scripts/serve-built-site.mjs` with the matching build.
It serves `dist/client` and forwards dynamic document/server-function requests to
the built Start server. A static-only server cannot prove dynamic SSR correctness.
This harness is not proof of hosted Edge Function parity: verify the actual deploy
preview too. `pnpm preview` is a convenience command, not the production acceptance gate.

## Preview acceptance

Record the deployed commit and exact preview URL, then verify:

1. Public and localized responses contain route-specific content and metadata.
2. Invalid routes/locales return correct not-found behavior.
3. The first landing-page click works with delayed JavaScript; hydration reports no
   mismatches and critical actions do not require a second click.
4. Auth callback/reset/return URLs, logout, and account/admin access work under the
   preview origin. Account responses must not be publicly cached.
5. Trip creation and owned/shared/example routes preserve existing persistence,
   permissions and navigation behavior.
6. API/image endpoints return their expected content types, never an HTML fallback.
7. The installed app can reopen a previously loaded/synced trip offline.
8. Runtime and benchmark evidence matches the deployed revision.

Check PR Quality and Netlify logs, not only a successful upload. A local passing
component suite cannot certify the hosted server/edge boundary.

## Deploy previews for a feature branch

1. Start the branch from `main` (or the base the issue names). Keep one issue per branch and one PR per branch.
2. Before pushing, run `pnpm typecheck` and `pnpm ci:local`. `ci:local` mirrors PR Quality,
   including core tests and the production build, so do not also run `test:core` and `build`
   separately. Use `pnpm install --frozen-lockfile` after dependency changes.
3. Push and open or update a PR. Netlify builds a Deploy Preview for each pushed commit.
4. Wait for the `netlify/travelflowapp/deploy-preview` check, then test on
   `https://deploy-preview-<PR_NUMBER>--travelflowapp.netlify.app`.
5. Check status with `gh pr checks <PR_NUMBER>` and the deploy log linked from the Netlify check.

Previews are commit-based: nothing rebuilds until you push. A stale `pnpm-lock.yaml` fails
the Netlify checks within seconds, before a normal deploy summary (2026-02-23 incident).
PR Quality checks out `pull_request.head.sha` so it validates the commit Netlify deploys.

### Environment keys for preview parity

Set these for the Deploy Preview context (or all contexts). Missing keys cause partial
behaviour, such as generation timeouts or OG/meta fallbacks:

- `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- `TF_ADMIN_API_KEY`
- `VITE_GOOGLE_MAPS_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (AI telemetry persistence and reads)
- Optional: `OPENROUTER_API_KEY` (curated OpenRouter models), `AI_GENERATE_PROVIDER_TIMEOUT_MS`

## Alias deploys serve no edge functions

`netlify deploy --no-build --dir=dist/client --alias <name>` uploads only the static client
output. It ships **no edge functions** and no Start server, so every `/api/*` route returns the
HTML app shell (`content-type: text/html`) instead of JSON. Verified 2026-08-19 and re-verified
2026-10-24: with `pnpm edge:validate` passing, an alias deploy still served `/api/health` and
`/api/runtime/location` as HTML while the PR's Deploy Preview answered correctly. Linking the
site first or running `netlify build` beforehand does not help.

In the product this looks like country guides showing "Practical destination information is
temporarily unavailable", and geolocation, nearby airports and distance sorting doing nothing.
This is a preview artifact, not an application bug.

A broken edge bundle produces the same symptom on every deploy (the 2026-08-18 outage, an
extensionless import); `pnpm edge:validate` guards against that. See [EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md).

Rule: use alias deploys only for static and client-side rendering checks. Verify anything that
touches `/api/*` on a real Deploy Preview or on production. Upload success is not evidence.
Keep build-time environment files private, never source one as shell code, and do not print
all Netlify environment values while diagnosing a build.

## Diagnosing a Netlify-only build failure

`pnpm build:netlify` uses your local env, so it can pass while Netlify fails. To reproduce the
build with the linked site's real environment, run:

```bash
pnpm dlx netlify build
```

It runs the `netlify.toml` build command with Netlify's own env injection and shows the failing
step directly.

Known cause: the per-variable **secret** flag on `VITE_*` variables. Secret values resolve masked
into the build, so the first step fails:

```
> pnpm runtime-env:validate
Production build blocked: VITE_SUPABASE_URL must be a valid HTTP(S) URL.
```

`SECRETS_SCAN_OMIT_KEYS` only exempts a key from the secrets scanner; it does not undo the flag.
Clear "secret" on the public `VITE_*` variables in Site config → Environment variables, and keep
server-side keys (`SUPABASE_SERVICE_ROLE_KEY`, `TF_ADMIN_API_KEY`, provider keys) secret.
Inspect metadata with `pnpm dlx netlify env:list --json` without printing or sharing raw values.
