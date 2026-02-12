# CODEX.md

## Startup checklist
1. Read `docs/UPDATE_FORMAT.md`.
2. If the task changes product behavior, plan release-note updates alongside code changes.
3. For any locale, translation, or page-routing change, read `docs/I18N_PAGE_WORKFLOW.md`.

## Required behavior for Codex
At the end of every completed feature or fix, update `content/updates/*.md`.

Rules:
- Use the schema in `docs/UPDATE_FORMAT.md`.
- Keep exactly one release note file per worktree/feature. Keep updating that same file instead of creating multiple files for one feature.
- Finalize the release note shortly before opening the PR, when the complete shipped scope is known.
- Keep user-facing highlights visible with `[x]`.
- Keep internal/infrastructure items hidden from marketing with `[ ]`.
- Each change line must start with a **content-matching emoji** — pick one that hints at the specific change. Do NOT use a fixed emoji per type (no 🚀 for every feature, no ✨ for every improvement).
- Only mark items `[x]` when they describe a clear **user benefit**. Technical details, dependency swaps, refactors, and implementation specifics should be `[ ]`.
- Write visible items from the user's perspective — what changed for them, not how it was built.
- Put major highlights first; place fixes later.
- Always bump to a new release `version` for every new published release.
- Never reuse or downgrade a published release version.
- Set `published_at` to the current time but **always before 23:00 UTC** — timestamps at or after 23:00 UTC display as the next day in CET. Ensure the timestamp is strictly after the previous version's `published_at`.
- Do not finish a feature task without updating release markdown when relevant.

## Validation
Run `npm run updates:validate` (or `npm run build`, which includes validation) before final handoff when possible.

## Direction-Safety Requirement
- For new or updated UI components, check whether CSS logical properties are appropriate for direction safety (`inline`, `block`, `start`, `end`).
- If it is unclear whether logical properties should be used, ask for clarification before finalizing.
