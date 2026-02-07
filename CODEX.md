# CODEX.md

## Startup checklist
1. Read `docs/UPDATE_FORMAT.md`.
2. If the task changes product behavior, plan release-note updates alongside code changes.

## Required behavior for Codex
At the end of every completed feature or fix, update `content/updates/*.md`.

Rules:
- Use the schema in `docs/UPDATE_FORMAT.md`.
- Keep user-facing highlights visible with `[x]`.
- Keep internal/infrastructure items hidden from marketing with `[ ]`.
- Put major highlights first; place fixes later.
- Always bump to a new release `version` for every new published release.
- Never reuse or downgrade a published release version.
- Do not finish a feature task without updating release markdown when relevant.

## Validation
Run `npm run updates:validate` (or `npm run build`, which includes validation) before final handoff when possible.
