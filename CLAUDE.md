# CLAUDE.md

## Startup checklist
1. Read `docs/UPDATE_FORMAT.md` before making product changes.
2. Follow existing project conventions and keep routes/components non-breaking.
3. For locale/translation/routing updates, follow `docs/I18N_PAGE_WORKFLOW.md`.
4. For user-facing copy updates (marketing, CTA, planner), follow `docs/UX_COPY_GUIDELINES.md`.
5. For analytics updates, follow `docs/ANALYTICS_CONVENTION.md`.
6. For localized copy placeholders, use ICU syntax (`{name}`), never `{{name}}` (project uses `i18next-icu`).
7. For new locale keys, update all active locales (`en`, `es`, `de`, `fr`, `pt`, `ru`, `it`, `pl`, `ko`) and choose namespace intentionally (`common/pages/legal` vs route namespace).

## Skill usage policy
- Use `vercel-react-best-practices` for React performance/refactor tasks; apply only relevant high-impact guidance for the active change.
- Run `npx -y react-doctor@latest . --verbose --diff` after substantial React edits, fix errors before merge, and triage warnings pragmatically.
- Use `find-skills` only when a task requires discovery of capabilities not already covered by current skills/workflows.
- Avoid unnecessary skill runs for straightforward changes.

## Mandatory release note rule
When a user-facing feature, fix, or behavior change is completed, you must update release notes in `content/updates/*.md` before finishing the task.

- Use the exact markdown format in `docs/UPDATE_FORMAT.md`.
- Keep one release note file per worktree/feature. Do not create multiple step-by-step files for the same feature.
- Finalize that single release note shortly before PR creation so it reflects the final shipped scope.
- Add user-facing items as `- [x] [Type] ...`.
- Add internal/non-marketing items as `- [ ] [Internal] ...`.
- Each change line must start with a **content-matching emoji** — pick an emoji that hints at what the specific change is about. Do NOT use a fixed emoji per type (no 🚀 for every feature, no ✨ for every improvement).
- Only mark items `[x]` (visible) when they describe a **clear user benefit**. Hide technical details, dependency changes, refactors, and implementation specifics as `[ ]`.
- Keep technical identifiers out of visible items (no route paths, code symbols, endpoints, or environment keys in `[x]` lines).
- Write visible items from the user's perspective — focus on what changed for them, not how it was built.
- Keep the most important user-facing items first, and fixes after primary highlights.
- Bump the release `version` whenever publishing a new release entry.
- Set `published_at` to when the change actually reached `main` (prefer production deploy timestamp; otherwise main merge timestamp), but **always before 23:00 UTC**. Timestamps at or after 23:00 UTC display as the next day in CET. Ensure the timestamp is strictly after the previous version's `published_at`.

## Completion gate
Before finalizing, ensure all applicable code changes are represented in release markdown and versioning is updated.
- For localization changes, run `npm run i18n:validate` and fix any locale parity/placeholder failures.

## Direction-Safety Requirement
- For any new or modified component, evaluate whether CSS logical properties should be used for direction-aware layouts.
- If usage is ambiguous, ask for clarification before shipping.

## Copy Approval Requirement
- For user-facing copy changes, ask for style approval in English and German before finalizing unless the user explicitly says to skip approval.
- Release-note copy in `content/updates/*.md` is exempt from EN/DE style sign-off prompts; do not ask for bilingual approval for release notes unless explicitly requested.

## Analytics Requirement
- For clickable marketing/planner UI changes, instrument events using `trackEvent(...)` and `getAnalyticsDebugAttributes(...)` per `docs/ANALYTICS_CONVENTION.md`.
- Use the existing event naming/payload convention; avoid ad-hoc query param tracking when Umami events are available.
