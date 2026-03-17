# AI Trip Generation Local Dev Runbook

Status: draft  
Date: 2026-03-07

## Purpose
Use this when testing the async trip-generation worker locally. The key rule is simple:

- `pnpm dev` serves the Vite app on `http://localhost:5173`
- `pnpm dev:netlify` serves Netlify Edge/Functions on `http://localhost:8888`
- async worker routes only behave correctly when **both** are running

## Recommended setup

### Terminal 1
```bash
pnpm dev
```

### Terminal 2
```bash
pnpm dev:netlify
```

### Browser URL
Prefer:

```text
http://localhost:8888
```

Why:
- this is the closest local parity to production
- all `/api/*` requests are handled by Netlify dev directly

`http://localhost:5173` can also work, but only because Vite proxies selected routes to `http://localhost:8888`. If Netlify dev is not running, Vite will log proxy errors.

## Required env
At minimum, keep these in `.env.local`:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
TF_ADMIN_API_KEY=...
AI_GENERATION_ASYNC_WORKER_ENABLED=true
VITE_GOOGLE_MAPS_API_KEY=...
```

Optional provider keys:

```env
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
OPENROUTER_API_KEY=...
```

Optional async timeout override:

```env
AI_GENERATION_ASYNC_PROVIDER_TIMEOUT_MS=120000
```

Current runtime clamp:
- minimum: `20000`
- maximum: `180000`
- default: `120000`

## Expected local request flow

### Create trip or retry
1. Browser persists placeholder trip.
2. Browser starts generation attempt log in Supabase.
3. Browser enqueues queue job in Supabase.
4. Browser best-effort kicks:
   - `POST /api/internal/ai/generation-worker?limit=1`
5. Worker claims a job and processes it in the background function path.
6. Trip page polls the trip row while generation is queued/running.

## If you see this error

```text
[vite] http proxy error: /api/internal/ai/generation-worker?limit=1
```

It means Vite tried to proxy the worker request to `http://localhost:8888`, but Netlify dev was not reachable there.

### Most common causes
1. `pnpm dev:netlify` is not running
2. port `8888` is already occupied
3. Netlify dev failed during edge-function startup
4. Vite is open on `5173`, but you expected production-like `/api/*` behavior without Netlify dev

### Fix sequence
1. Check whether `8888` is listening:

```bash
lsof -n -i :8888
```

2. If another process owns the port, stop it.
3. Start Netlify dev again:

```bash
pnpm dev:netlify
```

4. If Netlify dev reports an edge build failure, run:

```bash
pnpm edge:validate
```

5. Reload the app via:

```text
http://localhost:8888
```

## Important local behavior details

### `5173` vs `8888`
- `5173`: plain Vite app, plus a few proxy rules for worker/admin/map routes
- `8888`: Netlify dev entrypoint; use this for real async worker behavior

### Why `5173` still logs proxy errors
The repo intentionally proxies these routes from Vite to Netlify dev:
- `/api/internal/ai/generation-worker`
- `/api/internal/admin/iam`
- `/api/internal/admin/audit/replay-export`
- `/api/trip-map-preview`

So if `8888` is unavailable, Vite logs a proxy error instead of handling the route itself.

The async enqueue endpoint is proxied too:
- `/api/internal/ai/generation-enqueue`

If you see a retry error like:

```text
Could not enqueue async generation retry.
```

while running on `5173`, the usual cause is still the same: Netlify dev is not reachable on `8888`, so the async enqueue or worker kick could not complete locally.

### Cron is not required for basic local testing
For create/retry testing, the browser and trip page can kick the worker route directly.

You do **not** need to wait for scheduled cron execution just to test:
- create trip
- retry failed trip
- queued/running polling
- terminal success/failure rendering

Cron matters mainly for resilience when the initial worker kick is missed.

## Quick local smoke test
1. Start `pnpm dev`
2. Start `pnpm dev:netlify`
3. Open `http://localhost:8888/create-trip`
4. Create a trip
5. Confirm:
   - placeholder trip is created
   - `/api/internal/ai/generation-worker?limit=1` is hit
   - trip eventually becomes `succeeded` or `failed`
6. Retry a failed trip once and confirm:
   - no first-click retry burst
   - no `ASYNC_WORKER_JOB_MISSING` false failure while a leased job still exists

## Troubleshooting notes

### Netlify dev starts, but trip generation still does nothing
Check:
- `.env.local` has valid provider keys
- `AI_GENERATION_ASYNC_WORKER_ENABLED=true`
- Supabase schema/RPC changes are up to date

### Netlify dev starts, but `localhost:8888` shows no meaningful app behavior
Usually this means Vite is not running on `5173`, so Netlify dev has no target app to proxy to.

Start:

```bash
pnpm dev
```

and keep it running alongside Netlify dev.

### Worker still looks stuck
Inspect:
- trip row generation metadata
- `trip_generation_attempts`
- `trip_generation_jobs`
- Netlify function logs
- Netlify edge function logs

## Related docs
- [README.md](/Users/chrizzzly/.codex/worktrees/bece/travelflow-codex/README.md)
- [docs/EDGE_FUNCTIONS.md](/Users/chrizzzly/.codex/worktrees/bece/travelflow-codex/docs/EDGE_FUNCTIONS.md)
- [docs/AI_TRIP_GENERATION_RUNTIME_USERFLOWS.md](/Users/chrizzzly/.codex/worktrees/bece/travelflow-codex/docs/AI_TRIP_GENERATION_RUNTIME_USERFLOWS.md)
- [docs/AI_TRIP_GENERATION_ASYNC_POSTMORTEM_DRAFT.md](/Users/chrizzzly/.codex/worktrees/bece/travelflow-codex/docs/AI_TRIP_GENERATION_ASYNC_POSTMORTEM_DRAFT.md)
