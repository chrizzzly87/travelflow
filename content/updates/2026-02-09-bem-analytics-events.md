---
id: rel-2026-02-09-bem-analytics-events
version: v0.29.0
title: "Comprehensive analytics tracking"
date: 2026-02-09
published_at: 2026-02-09T23:45:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Consistent BEM-style analytics events now cover all interactive elements across the site."
---

## Changes
- [ ] [Internal] 📐 Introduced BEM-inspired analytics naming convention (`page__element` / `page__element--detail`) with TypeScript template literal enforcement and documented in `docs/ANALYTICS_CONVENTION.md`.
- [ ] [Internal] 🔄 Migrated 8 existing analytics events to the new naming convention.
- [ ] [Internal] 📊 Added 13 new tracking events across footer, early access banner, consent reject buttons, features CTA, pricing tier CTA, and all inspirations page interactive elements.
