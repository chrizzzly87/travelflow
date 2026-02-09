# AGENTS.md

This repository uses markdown release files as the source of truth for product updates.

## Agent requirements
- Follow `docs/UPDATE_FORMAT.md` for all release entries.
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

## Scope
These instructions apply to all coding agents and LLM assistants working in this repo.
