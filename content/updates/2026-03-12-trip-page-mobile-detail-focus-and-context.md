---
id: rel-2026-03-12-trip-page-mobile-detail-focus-and-context
version: v0.94.0
title: "Mobile trip details feel intentional again"
date: 2026-03-12
published_at: 2026-03-12T14:29:38Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Improves mobile trip-page detail interactions so selection stays calm, the full drawer opens only when you mean it, and timeline list stops show more useful context."
---

## Changes
- [x] [Improved] 📱 Mobile trip details no longer steal focus. Tapping a city or activity now selects it first, tapping again opens the full-height drawer, and closing the drawer clears that selection cleanly.
- [x] [Improved] 🗺️ On phones, the map now sits above the calendar and timeline so selecting extra trip details feels more deliberate.
- [x] [Improved] 🛏️ Timeline list stops now surface accommodation and subtle activity-type hints so each stop is easier to scan at a glance.
- [ ] [Internal] 🧪 Added regression coverage for the new mobile selection flow, full-height drawer behavior, mobile workspace order, and richer timeline list context.
