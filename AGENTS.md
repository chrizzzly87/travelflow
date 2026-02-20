# AGENTS.md

This repository uses markdown release files as the source of truth for product updates.

## Agent requirements
- Follow `docs/UPDATE_FORMAT.md` for all release entries.
- Follow `docs/UX_COPY_GUIDELINES.md` for any user-facing text changes (marketing pages, CTA copy, planner microcopy).
- Follow `docs/I18N_PAGE_WORKFLOW.md` for locale/translation/namespace changes.
- For user-facing copy changes in marketing/planner surfaces, request user style sign-off in English and German before finalizing unless the user explicitly opts out.
- Admin workspace copy (`/admin/*`, admin tables, drawers, and admin-only controls) is English-only by default and is exempt from EN/DE style sign-off and translation requirements unless the user explicitly asks for localization.
- For locale interpolation, use ICU placeholders (`{name}`), never `{{name}}`.
- When adding locale keys for localized user-facing surfaces, update all active locales (`en`, `es`, `de`, `fr`, `pt`, `ru`, `it`, `pl`, `ko`) and validate namespace placement (`common/pages/legal` vs route-specific namespace). Admin-only UI copy is excluded unless localization is explicitly requested.
- Run `npm run i18n:validate` for locale-related changes before finalizing.
- Release-note copy in `content/updates/*.md` is exempt from EN/DE style sign-off prompts; do not request bilingual sign-off for release notes unless the user explicitly asks for it.
- Follow `docs/ANALYTICS_CONVENTION.md` for all new or changed analytics instrumentation.
- For clickable UI on marketing/planner flows, add analytics using `trackEvent(...)` and `getAnalyticsDebugAttributes(...)` in the established format unless explicitly excluded.
- Reuse existing shared components/hooks before creating new UI patterns. For confirmation/prompt flows, use the styled app dialog system (`useAppDialog` from `components/AppDialogProvider`) instead of native browser prompts.
- After completing any feature/fix/change, update `content/updates/*.md`.
- Maintain exactly one release note file per worktree/feature. Do not create multiple incremental release-note files for the same work.
- Update/finalize that single release note shortly before opening the PR, once final scope is clear.
- Use `[x]` for website-visible user-facing items.
- Use `[ ]` for hidden internal items.
- Keep technical identifiers out of visible items (no route paths, code symbols, endpoints, or environment keys in `[x]` lines).
- Prefix every change line message with an emoji as defined in `docs/UPDATE_FORMAT.md`.
- Bump the release `version` whenever a new release is published.
- Keep versions strictly increasing; never reuse prior versions.
- Set `published_at` to when the change actually reached `main` (prefer production deploy timestamp; otherwise main merge timestamp), but **always before 23:00 UTC**. Timestamps at or after 23:00 UTC display as the next day in CET. Ensure the timestamp is strictly after the previous version's `published_at`.
- Keep entries concise, prioritized, and accurate.
- For new UI components and layout changes, explicitly check whether direction-aware styling is needed.
- Prefer CSS logical properties (for example `margin-inline`, `padding-inline`, `inset-inline`) over left/right-specific properties when it makes sense.
- If it is unclear whether logical properties are appropriate for a change, stop and ask the user for clarification before finalizing.

## Scope
These instructions apply to all coding agents and LLM assistants working in this repo.

## Skill usage policy
- Use `vercel-react-best-practices` for React performance/refactor tasks to guide high-impact decisions, but apply only rules relevant to the current change.
- Run `npx -y react-doctor@latest . --verbose --diff` after substantial React changes; treat reported errors as fix-before-merge and triage warnings by impact/scope.
- Use `find-skills` only when current skills/workflows do not clearly cover the task and a capability discovery step is needed.
- Avoid skill/tool churn: do not run unrelated skills for routine edits.
