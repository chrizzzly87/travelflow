---
id: rel-2026-02-13-polish-locale-rollout
version: v0.40.0
title: "Polish locale rollout and font coverage update"
date: 2026-02-13
published_at: 2026-02-13T14:17:32Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Added full Polish localization across site and planner flows, polished language switching, and improved support for Polish character rendering."
---

## Changes
- [x] [New feature] 🇵🇱 Added Polish as a fully supported language across the app and marketing pages.
- [x] [Improved] 🧭 Updated language selectors so Polish appears as the final option in dropdown order across header/mobile/settings UI.
- [x] [Improved] 🔤 Ensured Polish diacritics render correctly by loading Latin Extended font subsets for app and OG image generation paths.
- [x] [Improved] 🌍 Localized home example carousel CTAs and card content, including titles, tags, and destination labels.
- [ ] [Internal] 🗂️ Added an extendible locale-index in `countryTravelData.json` for translated country and island destination names keyed by destination code.
- [ ] [Internal] 🗺️ Extended locale-aware sitemap, blog validation, and edge metadata locale lists to include Polish routing and SEO coverage.
