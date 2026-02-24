---
id: rel-2026-02-23-activity-approval-visual-treatment
version: v0.56.0
title: "Activity Approval Visual Treatment Alignment"
date: 2026-02-23
published_at: 2026-02-23T21:35:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Not-approved activities now use the same subdued tentative styling language as not-approved city stays."
---

## Changes
- [x] [Improved] 🎨 Not-approved activities now keep stronger color contrast while still using a subtle lower-opacity appearance to signal tentative status.
- [x] [Improved] 🪄 Not-approved activities now show subtle diagonal stripes with a clearer dashed border so tentative items remain easy to spot.
- [x] [Fixed] 🧭 Vertical calendar transfers now render two clearly separated side-elbow connector lines that extend fully to city edges and route through a shared elbow trunk into the transport pill's top and bottom edge points.
- [x] [Improved] 📐 Vertical calendar spacing now gives transfers a wider column with larger, easier-to-read pills and left-aligned transport icons while keeping fixed-width activity lanes for clearer overlaps.
- [ ] [Internal] 🧩 Extended timeline block inactive styling logic so activity cards and city cards share the same modern color-mix rendering approach.
- [ ] [Internal] 📝 Added an agent workflow rule to always author GitHub PR descriptions from real Markdown body files so formatting stays stable and readable.
