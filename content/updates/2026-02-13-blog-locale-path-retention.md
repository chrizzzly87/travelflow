---
id: rel-2026-02-13-blog-locale-path-retention
version: v0.46.0
title: "Blog locale path retention for English fallback articles"
date: 2026-02-13
published_at: 2026-02-17T20:03:40Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Non-English blog browsing now keeps locale URL context when opening English-only posts, with clearer article-language messaging."
---

## Changes
- [x] [Fixed] 🌍 Opening an English-only blog post from a non-English blog view now keeps the active locale path and UI language context.
- [x] [Improved] 🧭 "Back to blog" and related article links now route to the active locale's blog paths.
- [x] [Improved] 🇬🇧 Blog post pages now show a localized English-content notice and scope `lang` attributes to article content.
- [x] [Improved] 🔗 Locale fallback article URLs now set a canonical link to the original English source page to prevent duplicate indexing.
