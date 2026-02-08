# AGENTS.md

This repository uses markdown release files as the source of truth for product updates.

## Agent requirements
- Follow `docs/UPDATE_FORMAT.md` for all release entries.
- After completing any feature/fix/change, update `content/updates/*.md`.
- Maintain exactly one release note file per worktree/feature. Do not create multiple incremental release-note files for the same work.
- Update/finalize that single release note shortly before opening the PR, once final scope is clear.
- Use `[x]` for website-visible user-facing items.
- Use `[ ]` for hidden internal items.
- Prefix every change line message with a context-aware emoji as defined in `docs/UPDATE_FORMAT.md`.
- Do not assign one fixed emoji per type (`New feature`, `Improved`, `Fixed`, etc.); choose emojis based on the actual content of each line.
- Bump the release `version` whenever a new release is published.
- Keep versions strictly increasing; never reuse prior versions.
- Keep entries concise, prioritized, and accurate.

## Scope
These instructions apply to all coding agents and LLM assistants working in this repo.
