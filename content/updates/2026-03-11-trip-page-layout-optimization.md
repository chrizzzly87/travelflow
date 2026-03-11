---
id: rel-2026-03-11-trip-page-layout-optimization
version: v0.92.1
title: "Trip pages feel smoother, clearer, and easier to steer"
date: 2026-03-11
published_at: 2026-03-11T21:27:28Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Trip pages now give titles and controls more room, make details easier to open and edit, stabilize map and pane layouts across resize changes, and clean up the planner and details dialog so controls feel more consistent again."
---

## Changes
- [x] [Improved] 🧭 A header that finally breathes. Trip titles get more room, open details on click, and keep Trips, Share, and Profile aligned in a cleaner action row.
- [x] [Improved] 🗂️ Trip details are easier to scan. The larger dialog now separates essentials, history, exports, destination context, and admin diagnostics into clearer sections.
- [x] [Fixed] 🗺️ The planner holds its shape when you resize. Docked and floating maps recover more reliably, pane handles behave again, and side panels stop fighting for space.
- [x] [Improved] 🔎 Zooming feels more useful at every scale. Calendar controls use compact 0.2 steps, Fit behaves more reliably, and vertical low-zoom views now show clearer day and month labels.
- [x] [Polished] 🎛️ Planner controls feel tidier again. Map orientation toggles are grouped in the expected stacked layout, and the title keeps its helpful click behavior without acting like a giant button press.
- [x] [Polished] 🪟 The trip dialog now feels more like the rest of TravelFlow. Tabs use a cleaner accent underline, inputs and buttons match shared surface styles, and the bulky boxed card treatment is replaced with lighter section spacing.
- [x] [Improved] ✅ Notes are easier to act on. Checklist items align better, stay interactive in both timeline and details views, and Heads Up tips now stand out as simple alert banners.
- [x] [Improved] ⌨️ Moving through a trip takes fewer clicks. Active city cards support keyboard navigation, and Enter or Space can open or close the matching details panel.
- [ ] [Internal] 🧪 Added regression coverage for shared history listeners, speculation-rules cleanup during hot reload, vertical low-zoom date rails, map control grouping, and planner pane behavior.
