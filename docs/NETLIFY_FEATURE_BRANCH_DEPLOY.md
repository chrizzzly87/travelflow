# Netlify Feature-Branch Deploy (LLM Quick Guide)

Use this when you need a safe deployed test URL for a branch before merging.

## Standard flow
1. Push your feature branch to GitHub.
2. Open or update a PR targeting `main`.
3. Netlify auto-creates/updates the **Deploy Preview** for that PR.
4. Wait for the `netlify/travelflowapp/deploy-preview` check to pass.
5. Test on the preview URL (for example `https://deploy-preview-<PR_NUMBER>--travelflowapp.netlify.app`).

## Required env keys for preview parity
At minimum, ensure these exist for Deploy Preview context (or all contexts):
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `TF_ADMIN_API_KEY`
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional compatibility keys:
- `VITE_GEMINI_API_KEY` (fallback path)
- `OPENROUTER_API_KEY` (reserved for future adapter)
- `AI_GENERATE_PROVIDER_TIMEOUT_MS` (override AI provider timeout; current sane default is handled in code)

## Common caveats
- Deploy Preview is commit-based: no new preview build appears until branch changes are pushed.
- Edge routes (`/api/*` via Netlify Edge Functions) only behave correctly in Netlify Preview/Production or `netlify dev`.
- If preview behaves differently from local `vite`, run `pnpm dlx netlify dev` for local parity.
- Missing env keys in Deploy Preview context can cause partial behavior (for example generation timeout/failure or OG/meta fallbacks).

## Manual CLI deploy with env parity
Use this when you need to push a draft deploy immediately (without waiting for Netlify PR checks), and the frontend requires `VITE_*` keys at build time.

1. Link the worktree once:
   - `pnpm dlx netlify link --id 1abc3d37-f6af-4810-9097-489b2a282ac6`
2. Build + deploy with `.env.local` safely parsed:
   - `pnpm dlx dotenv-cli -e .env.local -- pnpm dlx netlify deploy --build --alias <alias-name>`
3. Reuse the same alias to update an existing preview URL.

Notes:
- Do not use `source .env.local` for deployment commands; values containing special characters can fail shell parsing and silently skip env injection.
- Never commit `.env.local` or copied secret values.

## Useful checks
- PR checks:
  - `gh pr checks <PR_NUMBER>`
- Live deploy status:
  - open the deploy URL shown in the Netlify check details.
