# CLAUDE.md

## Startup checklist
1. Read `docs/UPDATE_FORMAT.md` before making product changes.
2. Follow existing project conventions and keep routes/components non-breaking.

## Mandatory release note rule
When a user-facing feature, fix, or behavior change is completed, you must update release notes in `content/updates/*.md` before finishing the task.

- Use the exact markdown format in `docs/UPDATE_FORMAT.md`.
- Keep one release note file per worktree/feature. Do not create multiple step-by-step files for the same feature.
- Finalize that single release note shortly before PR creation so it reflects the final shipped scope.
- Add user-facing items as `- [x] [Type] ...`.
- Add internal/non-marketing items as `- [ ] [Internal] ...`.
- Each change line must start with a **content-matching emoji** — pick an emoji that hints at what the specific change is about. Do NOT use a fixed emoji per type (no 🚀 for every feature, no ✨ for every improvement).
- Only mark items `[x]` (visible) when they describe a **clear user benefit**. Hide technical details, dependency changes, refactors, and implementation specifics as `[ ]`.
- Write visible items from the user's perspective — focus on what changed for them, not how it was built.
- Keep the most important user-facing items first, and fixes after primary highlights.
- Bump the release `version` whenever publishing a new release entry.

## Completion gate
Before finalizing, ensure all applicable code changes are represented in release markdown and versioning is updated.
