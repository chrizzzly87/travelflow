---
id: rel-2026-02-10-create-trip-design-variants
version: v0.46.0
title: "Create Trip: 3 experimental design variants for A/B testing"
date: 2026-02-11
published_at: 2026-02-11T06:20:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Three new Create Trip page layouts are now available for testing — Polished Card, Split-Screen Studio, and Journey Builder."
---

## Changes
- [x] [New feature] 🎨 Polished Card variant (`/create-trip/v1`) — elevated single-card form with glass-effect sections, season quality indicators, and travel style & vibe chips.
- [x] [New feature] 🖥️ Split-Screen Studio variant (`/create-trip/v2`) — full-width workspace with a live context panel showing country climate info, season timelines, and trip summary as you build.
- [x] [New feature] 🧭 Journey Builder variant (`/create-trip/v3`) — multi-step guided flow with popular destination picks, segmented budget/pace selectors, and a review summary before generation.
- [x] [Improved] 🔗 Quick links to all three variants are now shown below the quick-example pills on the existing Create Trip page.
- [x] [Improved] 🔀 Each variant now shows quick-switch links to all other variants and back to the main form.
- [x] [Improved] 📋 Switching between variants carries your form state (destinations, dates, preferences) automatically via URL prefill.
- [x] [Improved] 🎨 All feature-surface icons now use Phosphor duotone weight per brand guidelines.
- [x] [Fixed] 🎛️ Budget and Pace segmented controls in V3 now have even button widths on all screen sizes.
- [x] [Fixed] 💬 V3 Journey Builder now sends budget and pace preferences to AI trip generation.
- [x] [Fixed] 🗺️ Country selection, date pickers, and all form inputs now work correctly across all three variants.
- [ ] [Internal] Fixed CountrySelect/DateRangePicker prop interfaces to match component API (value/onChange).
- [ ] [Internal] Added budget/pace fields to WizardGenerateOptions interface and prompt builder.
- [ ] [Internal] Merged main branch updates including Lab page variants and FAQ/Share pages.
