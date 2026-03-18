---
id: rel-2026-03-17-country-alias-search-and-ai-normalization
version: v0.0.0
title: "Country search now understands familiar shortcuts and alternative names"
date: 2026-03-17
published_at: 2026-03-17T21:40:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Country search now recognizes localized names, familiar shortcuts, and common official or historical country variants, then normalizes them before trip generation."
---

## Changes
- [x] [Fixed] 🌍 Country search now recognizes localized names, familiar shortcuts, and common official or historical alternatives like UK, England, USA, UAE, Czechia, People’s Republic of China, DR Kongo, Swaziland, and Ceylon in the planner and profile country picker, so it is easier to find the right result without guessing the official label first.
- [ ] [Internal] 🗂️ Country search matching is now generated from shared locale metadata plus curated fallback aliases, and prefill, retry, and AI prompt inputs are normalized back to the canonical destination name with broader regression coverage.
