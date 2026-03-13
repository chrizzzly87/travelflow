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
- `published_at`: exact timestamp when the release became live on `main` (merge/deploy time), used for in-app 24h notice windows and ordering. **Must be < 23:00 UTC** — the site renders dates in CET (UTC+1), so timestamps at or after 23:00 UTC display as the next calendar day. Do **not** use feature start time or first draft time.
- `status`: `published` or `draft`. Keep feature/worktree entries as `draft` while the work is still in progress. Prefer publishing metadata in the main feature PR when the release is being finalized; use a follow-up only if the feature already merged without final metadata or the publish metadata needs correction afterward.
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
- Includes technical identifiers users should not see (route paths, API endpoints, function/class names, environment keys, or code snippets).

Write visible items from the user's perspective — focus on the benefit, not the implementation.

## Recommended workflow
1. Use exactly one release note file per worktree/feature.
2. Keep coding notes locally while implementing; avoid creating multiple incremental release files for one feature.
3. Keep the file accurate while the feature is in progress and leave `status: draft` until you are ready to finalize the release metadata.
4. Prefer publishing the metadata in the main feature PR:
   - Get the next merged/published version with `pnpm updates:next-version`.
   - Set `status: published`.
   - Set `published_at` to the actual deploy timestamp if available, otherwise the expected merge timestamp, always before 23:00 UTC.
   - Set `notify_in_app` as needed.
5. If the feature already merged without final metadata, publish it in one follow-up update instead of creating extra incremental release-note files.
6. Start the next draft file only for the next distinct feature/release.

## Versioning policy
- Every new published release must use a new version.
- Versions must be strictly increasing over publish time.
- Published versions should be gapless and canonical by `published_at` order (`v0.1.0`, `v0.2.0`, `v0.3.0`, ...).
- By default, non-canonical/gapless sequence issues are warnings in `updates:validate`; set `UPDATES_VALIDATE_STRICT_CANONICAL=1` to enforce as hard failures.
- Reusing a previous version is not allowed and should fail validation.
- Draft versions are provisional and do not reserve a published version number.

## Timezone rule
The site displays dates in CET (UTC+1). To ensure the correct date appears on the `/updates` page:
- `published_at` must always be **before 23:00 UTC** (i.e. before midnight CET).
- If you finish work after 23:00 UTC (00:00+ CET), use `date` for the next calendar day and set `published_at` accordingly.
- Timestamps must strictly increase with version number — the build validator (`scripts/validate-updates.mjs`) enforces this.
