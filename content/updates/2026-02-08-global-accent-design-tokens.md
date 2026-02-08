---
id: rel-2026-02-08-global-accent-design-tokens
version: v0.9.0
title: "Global accent color tokens and primary UI unification"
date: 2026-02-08
published_at: 2026-02-08T12:00:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Accent color now comes from one global token system, with a bright orange default that updates UI states, glows, and highlights across the app."
---

## Changes
- [x] [Improved] ✨ Added a global `accent`/`primary` design-token scale (`50-950`) in the shared CSS theme layer and switched the active default to a bright orange palette for branding tests.
- [x] [Improved] ✨ Migrated planner and marketing surfaces to use token-based `accent-*` utilities for buttons, links, focus rings, selections, and hover/active states.
- [x] [Improved] ✨ Added reusable accent glow utilities so soft emphasis and top-news highlights inherit from the same primary token values.
- [x] [Fixed] 🐛 Removed hardcoded primary accent values from markdown styles and map overlay labels so brand changes apply consistently.
- [x] [Fixed] 🐛 Roundtrip checkboxes in Create Trip now use accent-driven checkbox fill so they inherit the global primary color.
- [ ] [Internal] 🧰 Standardized semantic token aliases (`primary`, `primary-hover`, `primary-soft`, `primary-border`) to reduce future style drift.
