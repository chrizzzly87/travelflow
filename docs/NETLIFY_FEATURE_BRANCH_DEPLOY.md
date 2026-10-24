# Netlify Feature-Branch Deploy (LLM Quick Guide)

Use this when you need a safe deployed test URL for a branch before merging.

## Standard flow
1. Push your feature branch to GitHub.
2. Open or update a PR against the intended integration base. For the TanStack migration, use `codex/tanstack-start-integration`; production `main` requires separate preview acceptance.
3. Netlify auto-creates/updates the **Deploy Preview** for that PR.
4. Wait for the `netlify/travelflowapp/deploy-preview` check to pass.
5. Test on the preview URL (for example `https://deploy-preview-<PR_NUMBER>--travelflowapp.netlify.app`).

Verify the repository remote and linked site first. TravelFlow uses `travelflowapp`
(site ID `1abc3d37-f6af-4810-9097-489b2a282ac6`). See
[Start deployment ownership](NETLIFY_TANSTACK_START.md) for server artifacts and routing.

## Required env keys for preview parity
At minimum, ensure these exist for Deploy Preview context (or all contexts):
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `TF_ADMIN_API_KEY`
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (required for AI telemetry persistence/reads)

Optional compatibility keys:
- `OPENROUTER_API_KEY` (required when testing curated OpenRouter models)
- `AI_GENERATE_PROVIDER_TIMEOUT_MS` (override AI provider timeout; current sane default is handled in code)

## Common caveats
- Deploy Preview is commit-based: no new preview build appears until branch changes are pushed.
- Edge routes (`/api/*` via Netlify Edge Functions) only behave correctly in Netlify Preview/Production or `netlify dev`.
- If preview behaves differently from local `vite`, run `pnpm dlx netlify dev` for local parity.
- Missing env keys in Deploy Preview context can cause partial behavior (for example generation timeout/failure or OG/meta fallbacks).
- Lockfile drift can fail preview checks quickly (for example stale `pnpm-lock.yaml` against `package.json`).

## Incident note (2026-02-23)
- Cause: preview deploys failed because branch lockfile state was stale for the branch head commit.
- Symptom: Netlify checks (`Header rules`, `Redirect rules`, `Pages changed`) failed within seconds, before a normal deploy summary.
- Fix applied:
  - Synced `pnpm-lock.yaml` with `package.json`.
  - Updated PR CI (`pr-quality`) to checkout `pull_request.head.sha` so it validates the same commit Netlify deploys.

## Branch and PR hygiene standard
1. Start each issue from its intended base in a dedicated feature branch. Migration child branches start from the integration branch.
2. Keep branch scope to one issue/theme; avoid mixing unrelated work.
3. Commit incrementally during the implementation (small, reviewable commits).
4. Push branch updates continuously and keep one PR per feature branch.
5. Resolve all failing checks before requesting final review or merge.
6. If `main` moves significantly, rebase/merge `main` into the branch and rerun checks.

## Fast pre-push checklist
Run these from the feature branch before pushing:
1. `pnpm install --frozen-lockfile`
2. `pnpm test:core`
3. `pnpm build`

## Edge functions are NOT deployed by manual CLI alias deploys

**Verified 2026-08-19.** `netlify deploy --no-build --dir=dist --alias <name>` ships the static bundle but **no Netlify edge functions**. Every `/api/*` route on such a preview returns the SPA `index.html` with `content-type: text/html` instead of JSON.

Confirmed failing on an alias while all three worked on production:

- `/api/destinations` and `/api/destinations/<slug>`
- `/api/runtime/location`
- `/api/health`

Linking the project first (`netlify link --id ...`) and running a full `netlify build` beforehand did **not** help; the deploy still reported `CDN requesting 0 edge functions`.

### What this looks like in the product

- Country guide pages render "Practical destination information is temporarily unavailable. The core guide remains available."
- Anything depending on `runtime-location` (geolocation, nearby airports, distance sorting) silently does nothing.

**This is a preview artifact, not an application bug.** Do not debug it as a code regression, and tell anyone verifying on an alias preview to expect it.

**Re-verified 2026-10-24.** With `pnpm edge:validate` passing (so the edge bundle itself was
fine), a `pnpm build:netlify` + `netlify deploy --no-build --dir=dist --alias admin-redesign`
deploy still served `/api/health` and `/api/runtime/location` as `text/html`, while the PR's
Deploy Preview answered `/api/health` with `text/plain`. A separate, earlier outage (August
2026) came from an extensionless value import that broke the edge bundle for *every* deploy;
`pnpm edge:validate` guards that one. Both can produce the same symptom.

### Rule

- Use alias deploys only to check **static and client-side rendering**.
- Verify anything touching `/api/*` on a real Netlify **Deploy Preview** or on production.

## Manual deployment limitations

Use the Git-backed PR deploy preview for acceptance. A static alias upload such as
`netlify deploy --dir=dist` omits the Start server and does not establish parity
with the configured Edge Functions. Upload success is insufficient evidence.
The adapter generates server deployment artifacts; `dist/client` alone is not a
complete deploy. Keep build-time environment files private and never source an
environment file as shell code. Do not export all Netlify environment values into
tool output while diagnosing a build.

## Diagnosing a Netlify-only build failure

`pnpm build:netlify` uses your local env, so it can pass while Netlify fails. To reproduce Netlify's build with the **linked site's real environment**:

```bash
pnpm dlx netlify build
```

This runs the `netlify.toml` build command with Netlify's own env injection and surfaces the failing step directly, which makes the (often unreachable) Netlify build log unnecessary.

### Known cause: `is_secret` on `VITE_*` variables

Netlify's per-variable **secret** flag makes values resolve **masked** into the build. The `VITE_*` client variables in this project are public by design (see the comments in `netlify.toml`), so flagging them secret breaks the build at the first step:

```
> pnpm runtime-env:validate
Production build blocked: VITE_SUPABASE_URL must be a valid HTTP(S) URL.
```

`SECRETS_SCAN_OMIT_KEYS` only exempts a key from the secrets *scanner* — it does **not** undo the `is_secret` flag. Fix by clearing "secret" on the `VITE_*` variables in Site config → Environment variables. Keep genuinely server-side keys (`SUPABASE_SERVICE_ROLE_KEY`, `TF_ADMIN_API_KEY`, provider API keys) secret.

Inspect the flag without printing secrets:

```bash
pnpm dlx netlify env:list --json
# Inspect metadata locally; do not print or share raw values.
```

## Useful checks
- PR checks:
  - `gh pr checks <PR_NUMBER>`
- Live deploy status:
  - open the deploy URL shown in the Netlify check details.
