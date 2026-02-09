# Release Updates Markdown Format

All release notes live in `content/updates/*.md`.

## Why this format
- Human-editable markdown.
- Machine-parseable for website rendering and in-app release notices.
- Per-item visibility control for marketing output.

## File template

```md
---
id: rel-YYYY-MM-DD-short-slug
version: v0.0.0
title: "Release title"
date: YYYY-MM-DD
published_at: YYYY-MM-DDTHH:MM:SSZ
status: published
notify_in_app: true
in_app_hours: 24
summary: "One concise summary sentence."
---

## Changes
- [x] [New feature] 🗺️ Plan trips collaboratively with real-time shared cursors.
- [x] [Improved] ⚡ Itinerary generation now completes 3x faster.
- [x] [Fixed] 📍 Map markers no longer disappear after editing a city name.
- [ ] [Internal] Migrated state management to Zustand.
```

## Field rules
- `id`: unique stable release id.
- `version`: release label shown in update UI (for example `v0.7.0`).
- `date`: release date (`YYYY-MM-DD`).
- `published_at`: exact publish timestamp (used for in-app 24h notice window).
- `status`: `published` or `draft`.
- `notify_in_app`: if `true`, latest published release can appear inside trip view.
- `in_app_hours`: notice lifetime in hours (current default: `24`).
- `summary`: short description for cards/banners.

## Item rules
- Format: `- [x| ] [Type] Message`
- `[x]`: visible on marketing website (`/updates`).
- `[ ]`: hidden from marketing website but preserved in markdown history.
- `Type` is used for visual pills (`New feature`, `Improved`, `Fixed`, `Internal`, etc.).

### Emoji guideline
Each change line **must** start with a single emoji. Pick an emoji that **matches the specific content** of that line — do NOT use a fixed emoji per type. The emoji should visually hint at what the change is about.

Good examples:
- `- [x] [New feature] 🗺️ Interactive map now supports terrain and satellite layers.`
- `- [x] [Improved] ⚡ Trip generation is 3x faster with streaming responses.`
- `- [x] [Fixed] 📍 Fixed map markers disappearing after city rename.`
- `- [x] [New feature] 🤝 Share trips with co-travelers via a single link.`

Bad examples (do NOT do this):
- `- [x] [New feature] 🚀 Added map layers.` (🚀 for everything — generic, says nothing)
- `- [x] [Improved] ✨ Faster generation.` (✨ for every improvement — lazy)

### Visibility guideline
Only mark items as `[x]` (visible) when they communicate a **clear user benefit**. Ask: "Would a user care about this on a product changelog?"

Mark as `[ ]` (hidden) when the item:
- Is a technical implementation detail (e.g. dependency swaps, refactors, internal tooling).
- Describes *how* something was built rather than *what changed* for the user.
- Would require developer context to understand.

Write visible items from the user's perspective — focus on the benefit, not the implementation.

## Recommended workflow (auto-deploy friendly)
1. Use exactly one release note file per worktree/feature.
2. Keep coding notes locally while implementing; avoid creating multiple incremental release files for one feature.
3. Shortly before opening the PR, update/finalize that one release file with final shipped scope.
4. When ready to publish, bump the version to the next release number and set:
   - `status: published`
   - `published_at` to the publish time
   - `notify_in_app` as needed
5. Commit and push. Deploy will render it on `/updates`.
6. Start the next draft file only for the next distinct feature/release.

## Versioning policy
- Every new published release must use a new version.
- Versions must be strictly increasing over publish time.
- Reusing a previous version is not allowed and should fail validation.
