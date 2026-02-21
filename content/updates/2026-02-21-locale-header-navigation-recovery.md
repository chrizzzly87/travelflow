---
id: rel-2026-02-21-locale-header-navigation-recovery
version: v0.53.0
title: "Locale navigation recovery"
date: 2026-02-21
published_at: 2026-02-21T06:15:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Localized navigation, dropdown styling consistency, and example-trip info modal alignment are now stable across key user flows."
---

## Changes
- [x] [Fixed] 🌐 Localized pages now consistently keep the full top navigation visible after switching languages.
- [x] [Fixed] 🇩🇪 The language picker and account entry controls now stay intact across supported locales, including mobile navigation.
- [x] [Fixed] 🎛️ The language picker now uses the styled flag dropdown again instead of the plain system select list.
- [x] [Fixed] 🏳️ Language and destination dropdowns now render real flag icons again instead of emoji fallbacks.
- [x] [Improved] 🎚️ Trip planning forms now use a consistent styled dropdown across create-trip, settings, profile, and blog filters.
- [x] [Improved] 🧑‍🤝‍🧑 Traveler setup dropdowns now include clearer icons for gender and couple occasion selections.
- [x] [Fixed] 🪟 Trip information now opens in a centered modal layout so example-trip details no longer appear offset.
- [ ] [Internal] 🧩 Deferred styling sources now include shared navigation and banner components so responsive visibility rules remain synchronized.
- [ ] [Internal] 📐 Added an AGENTS rule requiring shadcn/Radix Select usage for product dropdowns so new UI avoids native browser select styling drift.
- [ ] [Internal] 🧱 Replaced remaining product native select elements with shared Radix/shadcn components to prevent browser-style drift.
- [ ] [Internal] 🏁 Restored shared `FlagIcon` rendering to use Flagpack CSS classes (`fp` + country code) and re-enabled the Flagpack stylesheet import.
