# LLM.md

## Global model guidance
- Read `docs/UPDATE_FORMAT.md` at the start of work.
- Read `docs/BRAND_CI_GUIDELINES.md` before implementing or restyling UI.
- Read `docs/PAYWALL_GUIDELINES.md` before changing trip expiration, lock, or access behavior.
- Read `docs/I18N_PAGE_WORKFLOW.md` before adding/updating localized pages, route strategy, or translation resources.
- Keep code changes aligned with existing architecture and route stability.
- Any completed feature/fix must be reflected in `content/updates/*.md`.
- For new components, check whether logical CSS properties should be used for direction safety; if unclear, ask for clarification.

## Update entry policy
- Use one release note file per worktree/feature, not multiple incremental files.
- Finalize/update that single release note shortly before opening the PR.
- User-facing items: `- [x] [Type] ...`
- Internal-only items: `- [ ] [Internal] ...`
- Prefix each change message with the emoji style defined in `docs/UPDATE_FORMAT.md`.
- Most important changes first, fixes later.
- Bump and maintain strictly increasing release versions for published entries.
