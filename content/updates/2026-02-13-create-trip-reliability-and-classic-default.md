---
id: rel-2026-02-13-create-trip-reliability-and-classic-default
version: v0.40.0
title: "Create-trip reliability fix and Classic Card default rollout"
date: 2026-02-13
published_at: 2026-02-13T15:45:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Create-trip now recovers automatically from stale lazy chunks on first load, and the Classic Card experience is the new default with a cleaner, production-ready flow."
---

## Changes
- [x] [Fixed] 🧩 Added automatic lazy-chunk recovery with a one-time reload guard, so first-load stale module failures no longer dead-end create-trip and other lazy routes.
- [x] [Improved] 🧭 Rolled out Classic Card Overhaul as the default `/create-trip` experience while preserving the legacy form and all other lab concepts on dedicated routes.
- [x] [Improved] ✅ Added required-state completion checks for Destination and Dates, restored blog-style destination search input, and moved selected-country chips below the input with the original button-style visual treatment.
- [x] [Fixed] 🔁 Restored `prefill` URL handling for Classic Card so inspiration links populate destinations/dates/options on first load again.
- [x] [Fixed] 🧭 Restored the Travel Snapshot route-path arrows/loop visualization and aligned the mobile sticky snapshot to the same visual style as desktop.
- [x] [Fixed] 👥 Restored per-traveler settings modal controls and transport behavior (`Automatic` vs multi-select), with camper visible but disabled for now.
- [x] [Fixed] 🏳️‍🌈 Restored same-sex couple traveler-modal rainbow mode styling and fixed traveler settings interpolation rendering in localized copy.
- [x] [Improved] 📱 Added a mobile/tablet sticky trip snapshot footer with primary create action and expandable details, including safe bottom spacing to avoid content overlap.
- [x] [Improved] 📅 Refined mobile snapshot readability with visible travel dates and restored +/- week steppers for flexible trip duration input.
- [x] [Improved] 🤖 Switched the default Classic Card flow to in-page AI generation (`aiService`) and aligned admin benchmark input masking to the same UI shape without changing prompt contract semantics.
- [x] [Improved] 🌍 Added a dedicated `createTrip` i18n namespace across all supported locales, wired tool-route language preloading, and fixed locale state sync so create-trip navigation, country names, and date labels stay in the active app language.
- [x] [Fixed] 🌐 Fixed tool-route language state sync so changing language on create-trip persists across hard reloads, including localized URLs like `/:locale/create-trip`.
- [x] [Improved] 🌍 Added localized create-trip route support (`/:locale/create-trip`) and locale-aware switching for planner entry links while keeping trip/share URLs unchanged.
- [x] [Improved] 🏷️ Added localized OG/meta output for localized create-trip URLs so shared planner links use language-matching title/description.
- [x] [Improved] 📱 Increased vertical spacing and readability in the mobile trip snapshot footer (headline, pills, and expanded details).
- [x] [Fixed] 🌐 Completed create-trip namespace localization coverage for all supported locales (`en,de,es,fr,it,pt,ru,pl`), including a new Polish locale file and fully translated French planner strings.
- [x] [Fixed] 🧾 Corrected create-trip interpolation placeholders from double-curly to ICU format (`{label}`), so prefill badges render translated labels correctly in every locale.
- [x] [Fixed] 🗓️ Localized ideal-travel tooltip month initials using `Intl.DateTimeFormat`, so month letters follow the active language instead of English-only abbreviations.
- [ ] [Internal] 📈 Added create-trip interaction event instrumentation and chunk-recovery observability updates to the analytics convention catalog.
- [ ] [Internal] 📄 Added prompt-mapping and DB-tracking strategy docs to define no-effect fields, effective defaults, and phased post-auth telemetry design.
