---
id: rel-2026-02-23-trip-city-panels-modern-uncertain-options
version: v0.56.0
title: "Modernized City Panels and Uncertain Stop Variants"
date: 2026-02-23
published_at: 2026-02-23T14:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Trip city panels now use softer modern color blending and can visually represent tentative city options."
---

## Changes
- [x] [Improved] 🎨 City stay cards now use softer palette-aware color blending with crisp outlines and adaptive text contrast for clearer readability.
- [x] [New feature] 🪄 Tentative city options now render as semi-transparent striped cards so non-final stops are easy to spot.
- [x] [Improved] 🧩 Overlapping city stays now stack into aligned lanes with tiny spacing, and city rows expand for extra overlaps while each card stays capped at the default height.
- [x] [Improved] 🎯 Selected city cards and resize handles now have stronger focus/hover states for clearer editing feedback.
- [x] [Improved] ✅ City and activity details now include an approval switch so tentative plan elements can be tracked without blocking edits.
- [x] [Fixed] 🧭 Approved alternative cities now reliably drive transfer connector routing, including lower-lane options in overlap groups.
- [x] [Fixed] 🚉 Transfer chips no longer collapse into unreadable slivers; dense legs are packed into extra transfer lanes to avoid overlap.
- [x] [New feature] 🧪 Added a new flexible Mediterranean example trip so teams can test uncertain city variants in a real itinerary.
- [ ] [Internal] 🧱 Extended itinerary item metadata to support uncertain city status and grouped alternative options.
- [ ] [Internal] 🛠️ Synced the workspace lockfile with package manifest updates so CI/Netlify installs run reliably with frozen lockfile mode.
