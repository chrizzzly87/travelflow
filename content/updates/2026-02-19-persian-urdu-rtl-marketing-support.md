---
id: rel-2026-02-19-persian-urdu-rtl-marketing-support
version: v0.50.0
title: "Persian and Urdu marketing RTL support"
date: 2026-02-19
published_at: 2026-02-19T17:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Added Persian and Urdu language options for marketing pages with automatic RTL direction handling and destination-name locale coverage updates."
---

## Changes
- [x] [New feature] 🌍 Added Persian and Urdu as selectable website languages on marketing pages.
- [x] [Improved] 🗣️ Homepage and core marketing navigation copy now appear in Persian and Urdu instead of English fallback text.
- [x] [Improved] ↔️ Page reading direction now switches automatically between left-to-right and right-to-left based on the selected language.
- [x] [Improved] 🧭 Destination and country-name data now includes Persian and Urdu locale entries.
- [x] [Improved] 📝 Persian and Urdu interfaces now use Vazirmatn for clearer Arabic-script typography.
- [x] [Improved] 🪞 Social preview cards now mirror the layout direction for Persian and Urdu so text and visual hierarchy read naturally.
- [ ] [Internal] 🧱 Extended locale, profile, and SEO metadata mappings so language and direction stay synchronized across runtime and edge rendering.
- [ ] [Internal] 🖼️ Persian and Urdu OG previews now use a dedicated RTL dynamic rendering path to preserve layout direction and script shaping.
- [ ] [Internal] 🎛️ Static OG filter flags now accept base paths with locale filters and gracefully no-op when selections are dynamic-only RTL routes.
- [ ] [Internal] 🔎 Admin OG tools now include a Persian preset route for quick RTL/Vazirmatn preview checks.
