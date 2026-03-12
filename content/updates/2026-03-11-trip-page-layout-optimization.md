---
id: rel-2026-03-11-trip-page-layout-optimization
version: v0.92.4
title: "Trip pages feel smoother, clearer, and easier to steer"
date: 2026-03-11
published_at: 2026-03-12T07:34:52Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Trip pages now feel calmer and more predictable across desktop and mobile, with full-day activity cards that stay readable, floating-map controls that no longer get trapped, cleaner trip details tabs, and a mobile details drawer that stays out of the way until you need it."
---

## Changes
- [x] [Fixed] 🛟 Trip pages load reliably again after the latest polish pass. A mobile viewport state regression that could stop the planner from rendering has been resolved.
- [x] [Fixed] 🗂️ Trip details tabs now sit cleanly on the divider again. The underline anchors directly to the grey rule without the extra offset or boxed active state.
- [x] [Improved] 📍 Floating maps feel safer to move. The preview now stays above planner controls in floating mode, so the move handle cannot get trapped underneath other UI.
- [x] [Improved] 🪟 Mobile details drawers give a clearer cue without taking over. The bottom peek is taller, background scrolling stays available in list view, and opening the drawer is now more intentional.
- [x] [Improved] 📝 Horizontal activity cards are much easier to read. Activities now claim the full day they touch in the horizontal planner, which gives rotated labels more height, keeps icons at the top, and makes short-duration activities easier to scan at any zoom level.
- [x] [Improved] 🧭 Trip navigation feels lighter and more focused. The title sits closer to the TravelFlow mark, opens trip details on click, and profile actions now center around Create Trip and My Trips instead of a crowded shortcut list.
- [x] [Improved] 📱 Mobile trip pages stay calmer while you explore. Account menus layer above planner controls, the profile trigger collapses to the avatar, toast popups stay out of the way, and the details drawer now peeks from the bottom instead of taking over immediately.
- [x] [Fixed] 🗓️ Low-zoom calendars use space much better. Vertical views now center month labels across the visible span, compact day rails stay readable, and small activity cards in the planner are easier to scan at a glance.
- [x] [Polished] ✍️ Trip details editing feels like the rest of TravelFlow again. Tabs sit cleanly on the divider, the trip title uses the shared input style, favorites stay right beside the name field, and Escape cleanly cancels draft title edits.
- [x] [Fixed] 🎛️ Planner controls feel tidier and less distracting. Zoom controls stay compact, desktop keeps the zoom readout where it helps, and map layout toggles are grouped like proper orientation switches again.
- [x] [Improved] ✅ Notes and checklists are easier to work with. Checklist rows stay aligned, task toggles now hit the correct line in timeline and details views, and Heads Up guidance shows up as simple banner-style callouts.
- [x] [Improved] ⌨️ Moving through a trip takes fewer clicks. Active city cards support keyboard travel with arrow keys or Tab, and Enter or Space can open or close the matching details panel.
- [ ] [Internal] 🧪 Added regression coverage for low-zoom month rails, mobile peek drawers, account-menu trip actions, modal title editing, and planner control behavior.
- [ ] [Internal] 🧷 Added regression coverage to keep mobile viewport state declared before the trip-view callbacks that depend on it.
- [ ] [Internal] 🧪 Added regression coverage for the passive mobile drawer preview, the cleaned-up line tabs, and the floating map layer order.
