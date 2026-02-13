# AGENTS.md

This repository uses markdown release files as the source of truth for product updates.

## Agent requirements
- Follow `docs/UPDATE_FORMAT.md` for all release entries.
- Follow `docs/UX_COPY_GUIDELINES.md` for any user-facing text changes (marketing pages, CTA copy, planner microcopy).
- For user-facing copy changes, request user style sign-off in English and German before finalizing unless the user explicitly opts out.
- Release-note copy in `content/updates/*.md` is exempt from EN/DE style sign-off prompts; do not request bilingual sign-off for release notes unless the user explicitly asks for it.
- Follow `docs/ANALYTICS_CONVENTION.md` for all new or changed analytics instrumentation.
- For clickable UI on marketing/planner flows, add analytics using `trackEvent(...)` and `getAnalyticsDebugAttributes(...)` in the established format unless explicitly excluded.
- After completing any feature/fix/change, update `content/updates/*.md`.
- Maintain exactly one release note file per worktree/feature. Do not create multiple incremental release-note files for the same work.
- Update/finalize that single release note shortly before opening the PR, once final scope is clear.
- Use `[x]` for website-visible user-facing items.
- Use `[ ]` for hidden internal items.
- Prefix every change line message with an emoji as defined in `docs/UPDATE_FORMAT.md`.
- Bump the release `version` whenever a new release is published.
- Keep versions strictly increasing; never reuse prior versions.
- Set `published_at` to the current time but **always before 23:00 UTC** — timestamps at or after 23:00 UTC display as the next day in CET. Ensure the timestamp is strictly after the previous version's `published_at`.
- Keep entries concise, prioritized, and accurate.
- For new UI components and layout changes, explicitly check whether direction-aware styling is needed.
- Prefer CSS logical properties (for example `margin-inline`, `padding-inline`, `inset-inline`) over left/right-specific properties when it makes sense.
- If it is unclear whether logical properties are appropriate for a change, stop and ask the user for clarification before finalizing.

## Scope
These instructions apply to all coding agents and LLM assistants working in this repo.
