---
id: rel-2026-02-18-og-font-latin-priority-fix
version: v0.51.0
title: "OG preview typography and shared-link resilience fixes"
date: 2026-02-18
published_at: 2026-02-18T14:30:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Fixed social preview typography fallbacks and restored rich trip previews when shared trip pages are opened from direct trip links."
---

## Changes
- [x] [Fixed] 🔤 Shared and page social preview titles now render with the intended brand typography more consistently.
- [x] [Improved] 🎚️ Social previews now keep branded typography across a wider range of headline font weights.
- [x] [Fixed] 🔗 Shared trips now keep rich social previews even when a direct trip page link is shared.
- [x] [Improved] ↪️ Direct trip links now route non-owner viewers to the shared version when an active share already exists.
- [x] [Improved] 🔐 Non-shared private trip links now route users to clear next steps (login for unauthenticated visitors, unavailable state for non-owners) instead of dropping to trip creation.
- [ ] [Internal] 🧱 Updated OG font loading priority so full Latin font files are selected before partial extended subsets.
- [ ] [Internal] 🧮 Added OG font-weight alias coverage from 100 to 900 so future weight tweaks avoid system-font fallback.
- [ ] [Internal] 🛡️ Added server-side share-token resolution for direct trip OG metadata/image rendering so preview data can be loaded from active share state.
- [ ] [Internal] 🗺️ Added documented sharing userflow charts and redirect semantics for trip-vs-share route handling.
