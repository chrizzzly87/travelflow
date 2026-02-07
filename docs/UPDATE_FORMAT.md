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
- [x] [New feature] User-facing highlight shown on the website updates page.
- [x] [Improved] User-facing improvement shown on the website updates page.
- [x] [Fixed] User-facing fix shown on the website updates page.
- [ ] [Internal] Kept in markdown history, hidden from marketing website output.
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

## Recommended workflow (auto-deploy friendly)
1. Start a file with `status: draft` for an upcoming release batch.
2. Add/update items while work is in progress.
3. When ready to publish, bump the version to the next release number and set:
   - `status: published`
   - `published_at` to the publish time
   - `notify_in_app` as needed
4. Commit and push. Deploy will render it on `/updates`.
5. Start the next draft file for the next batch.

## Versioning policy
- Every new published release must use a new version.
- Versions must be strictly increasing over publish time.
- Reusing a previous version is not allowed and should fail validation.
