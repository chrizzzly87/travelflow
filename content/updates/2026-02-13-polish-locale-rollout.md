---
id: rel-2026-02-13-polish-locale-rollout
version: v0.54.0
title: "Polish locale rollout and font coverage update"
date: 2026-02-13
published_at: 2026-02-13T14:13:17Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Added full Polish localization across marketing/app namespaces, aligned language switching UX, and ensured Latin Extended font coverage for Polish characters."
---

## Changes
- [x] [New feature] 🇵🇱 Added Polish (`pl`) as a fully supported app and marketing language with translated copy across all active namespaces.
- [x] [Improved] 🧭 Updated language selectors so Polish appears as the final option in dropdown order across header/mobile/settings UI.
- [x] [Improved] 🔤 Ensured Polish diacritics render correctly by loading Latin Extended font subsets for app and OG image generation paths.
- [x] [Improved] 🌍 Localized the home example carousel CTA and card content (titles, tags, day/city labels, and destination names) with dedicated example-card locale maps.
- [ ] [Internal] 🗂️ Added an extendible locale-index in `countryTravelData.json` for translated country and island destination names keyed by destination code.
- [ ] [Internal] 🗺️ Extended locale-aware sitemap, blog validation, and edge metadata locale lists to include Polish routing and SEO coverage.
