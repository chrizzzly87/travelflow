---
id: rel-2026-02-18-og-font-latin-priority-fix
version: v0.50.0
title: "OG preview typography fallback regression fix"
date: 2026-02-18
published_at: 2026-02-18T14:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Fixed a social preview typography regression and expanded OG font-weight coverage so title styles stay consistent."
---

## Changes
- [x] [Fixed] 🔤 Shared and page social preview titles now render with the intended brand typography more consistently.
- [x] [Improved] 🎚️ Social previews now keep branded typography across a wider range of headline font weights.
- [ ] [Internal] 🧱 Updated OG font loading priority so full Latin font files are selected before partial extended subsets.
- [ ] [Internal] 🧮 Added OG font-weight alias coverage from 100 to 900 so future weight tweaks avoid system-font fallback.
