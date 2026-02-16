---
id: rel-2026-02-16-flagpack-real-flags
version: v0.41.0
title: "Flagpack rollout for consistent real flags"
date: 2026-02-16
published_at: 2026-02-16T06:51:35Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Replaced emoji flag rendering with a shared Flagpack-based flag component across planner, inspiration, blog, and language UI."
---

## Changes
- [x] [Improved] 🏳️ Replaced emoji-flag rendering with real SVG flags in planner destination chips, pickers, labs, and country context cards.
- [x] [Improved] 🌐 Updated language selectors, language suggestions, and English-article notices to use the new shared flag system.
- [x] [Improved] 🧭 Updated inspirations cards, country pills, and trip-list row flags to render through `FlagIcon` for consistent display.
- [ ] [Internal] 📘 Added destination-system guidance to use `FlagIcon` + `flagpack` for all future flag-related UI work.
