---
id: rel-2026-03-02-map-transition-stability-followup
version: v0.77.0
title: "Floating map transition stability follow-up"
date: 2026-03-02
published_at: 2026-03-02T08:31:05Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Trip planner floating map transitions were hardened to stay stable under rapid layout and resize interactions."
---

## Changes
- [x] [Improved] 🛡️ Floating map resize handling is now throttled and debounced to reduce burst animation load during rapid layout and panel resizing.
- [x] [Improved] ⚙️ Floating map geometry updates now avoid continuous spring churn during active resize bursts and settle smoothly afterward.
- [x] [Improved] 🎯 Floating map rendering hints now activate only during active interaction to keep motion smoother under stress.
- [ ] [Internal] 🧪 Added regression coverage for rapid viewport-resize persistence behavior in floating map mode.
- [ ] [Internal] 🔍 Added follow-up crash investigation issue tracking for intermittent planner instability during map/layout transition bursts.
