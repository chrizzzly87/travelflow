---
id: rel-2026-02-08-indigo-accent-default
version: v0.12.0
title: "Accent default reset to indigo"
date: 2026-02-08
published_at: 2026-02-08T15:00:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "The global accent default now uses the previous indigo/blue palette again while keeping the token-based theming system in place."
---

## Changes
- [x] [Improved] Reset the global `accent` token scale to an indigo/blue default palette.
- [x] [Improved] Kept all UI surfaces token-driven, so future brand color switches still apply globally from one place.
- [x] [Fixed] Updated My Trips tooltip map fallback colors to indigo so map previews match the active accent theme.
- [ ] [Internal] Retained token infrastructure and shadcn checkbox integration for future palette experiments.
