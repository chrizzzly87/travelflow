# CLAUDE.md

## Startup checklist
1. Read `docs/UPDATE_FORMAT.md` before making product changes.
2. Follow existing project conventions and keep routes/components non-breaking.

## Mandatory release note rule
When a user-facing feature, fix, or behavior change is completed, you must update release notes in `content/updates/*.md` before finishing the task.

- Use the exact markdown format in `docs/UPDATE_FORMAT.md`.
- Add user-facing items as `- [x] [Type] ...`.
- Add internal/non-marketing items as `- [ ] [Internal] ...`.
- Keep the most important user-facing items first, and fixes after primary highlights.
- Bump the release `version` whenever publishing a new release entry.

## Completion gate
Before finalizing, ensure all applicable code changes are represented in release markdown and versioning is updated.
