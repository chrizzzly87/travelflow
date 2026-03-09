---
id: rel-2026-03-09-progressive-image-skipfade-hotfix
version: v0.0.0
title: "Progressive image skip-fade hotfix"
date: 2026-03-09
published_at: 2026-03-09T19:58:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Fixes a blog image regression that could crash pages using the immediate image reveal path."
---

## Changes
- [x] [Fixed] 🖼️ Blog pages no longer crash when shared transitions request an immediate image reveal.
- [ ] [Internal] 🧪 Restored the `skipFade` prop contract on `ProgressiveImage` and added a component regression test for the render path.
