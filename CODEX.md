# CODEX.md

## Startup checklist
1. Read `docs/UPDATE_FORMAT.md`.
2. If the task changes product behavior, plan release-note updates alongside code changes.
3. For any locale, translation, or page-routing change, read `docs/I18N_PAGE_WORKFLOW.md`.
4. For any user-facing text changes (marketing, CTA, planner), read `docs/UX_COPY_GUIDELINES.md`.
5. For analytics instrumentation, read `docs/ANALYTICS_CONVENTION.md`.
6. For localized copy placeholders, always use ICU syntax (`{name}`), never `{{name}}` (project uses `i18next-icu`).
7. For new locale keys, update all active locales (`en`, `es`, `de`, `fr`, `pt`, `ru`, `it`, `pl`, `ko`) and choose namespace intentionally (`common/pages/legal` vs route namespace).

## Skill usage policy
- For React performance or refactor work, consult `vercel-react-best-practices` and apply only the rules that materially affect the task.
- After substantial React changes, run `npx -y react-doctor@latest . --verbose --diff`; fix errors before merge and prioritize warnings by risk.
- Use `find-skills` only for targeted capability discovery when existing project workflows/skills are insufficient.
- Do not overuse skills for routine edits that are already covered by current repo conventions.

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
For locale changes, run `npm run i18n:validate` to enforce namespace parity and ICU placeholder syntax.

## Direction-Safety Requirement
- For new or updated UI components, check whether CSS logical properties are appropriate for direction safety (`inline`, `block`, `start`, `end`).
- If it is unclear whether logical properties should be used, ask for clarification before finalizing.

## Copy Approval Requirement
- For new or rewritten user-facing copy, request style sign-off from the user in English and German before finalizing, unless the user explicitly opts out.
- Release-note copy in `content/updates/*.md` is exempt from EN/DE style sign-off prompts; do not request bilingual sign-off for release notes unless explicitly requested.

## Analytics Requirement
- When adding or changing clickable UI in marketing/planner flows, add tracking with `trackEvent(...)` and `getAnalyticsDebugAttributes(...)` following `docs/ANALYTICS_CONVENTION.md`.
- Keep event naming and payload structure consistent with existing conventions.
