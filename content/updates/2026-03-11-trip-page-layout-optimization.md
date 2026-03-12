---
id: rel-2026-03-11-trip-page-layout-optimization
version: v0.92.0
title: "Trip pages feel smoother, clearer, and easier to steer"
date: 2026-03-11
published_at: 2026-03-12T09:13:05Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Trip pages now feel calmer and more predictable across desktop and mobile, with more readable mobile profile layouts, a less intrusive details drawer, a centered share dialog on phones, and safer recovery from stale share chunks."
---

## Changes
- [x] [Fixed] 🤝 Sharing now fails more gracefully after stale app updates. The trip share flow recognizes MIME-type chunk mismatches as recoverable, so a stale cached page is much less likely to strand the share dialog behind a broken lazy import.
- [x] [Improved] 📱 Mobile trip sharing feels steadier. The share dialog now opens centered instead of dropping into a bottom sheet on small screens.
- [x] [Improved] 🪟 Mobile trip details stay out of the way until you ask for them. Selecting a city no longer auto-opens the drawer, the bottom peek is easier to grab, and scrolling the timeline stays more natural while details remain collapsed.
- [x] [Improved] 🙋 Profile pages feel lighter on phones. Mobile now focuses on the greeting and trip list first, keeps a simple Edit profile action close at hand, and lets trip cards span the full column before stepping up to two and three columns on larger screens.
- [x] [Fixed] 💬 Greetings and profile names read more naturally on smaller screens. Greeting text now wraps by whole words instead of single letters, the pronunciation line uses accent styling with prettier wrapping, and the owner profile now prefers the saved first and last name over stale display-name leftovers.
- [x] [Improved] 📍 City detail basics are easier to scan. The approval toggle now sits below the location instead of competing with the title area.
- [x] [Improved] 🧭 Small-screen trip headers make better use of the space they already have. The hidden hover-only info pill no longer reserves room on mobile, so the trip title can breathe more naturally beside the TravelFlow mark.
- [x] [Fixed] 🛟 Trip pages load reliably again after the latest polish pass. A mobile viewport state regression that could stop the planner from rendering has been resolved.
- [x] [Fixed] 🗂️ Trip details tabs now sit cleanly on the divider again. The underline anchors directly to the grey rule without the extra offset or boxed active state.
- [x] [Improved] 📍 Floating maps feel safer to move. The preview now stays above planner controls in floating mode, so the move handle cannot get trapped underneath other UI.
- [x] [Improved] 🪟 Mobile details drawers give a clearer cue without taking over. The bottom peek is taller, background scrolling stays available in list view, and opening the drawer is now more intentional.
- [x] [Improved] 📝 Horizontal activity cards are much easier to read. Activities now claim the full day they touch in the horizontal planner, rotated labels use the full available height instead of clipping inside hidden spacing, and icons stay pinned to the top for cleaner scanning at any zoom level.
- [x] [Improved] 🧭 Trip navigation feels lighter and more focused. The title sits closer to the TravelFlow mark, opens trip details on click, and profile actions now center around Create Trip and My Trips instead of a crowded shortcut list.
- [x] [Improved] 📱 Mobile trip pages stay calmer while you explore. My Trips now layers above the account menu and navigation when it slides in, the profile avatar keeps its circular shape, toast popups stay out of the way, and the details drawer now peeks from the bottom instead of taking over immediately.
- [x] [Fixed] 🗓️ Low-zoom calendars use space much better. Vertical views now center month labels across the visible span, compact day rails stay readable, and small activity cards in the planner are easier to scan at a glance.
- [x] [Polished] ✍️ Trip details editing feels like the rest of TravelFlow again. Tabs sit cleanly on the divider, the trip title uses the shared input style, the action copy now reads clearly as Edit Title and Save Title, favorites stay right beside the name field, and Escape cleanly cancels draft title edits.
- [x] [Fixed] 🎛️ Planner controls feel tidier and less distracting. Zoom controls stay compact, desktop keeps the zoom readout where it helps, and map layout toggles are grouped like proper orientation switches again.
- [x] [Improved] ✅ Notes and checklists are easier to work with. Checklist rows stay aligned, task toggles now hit the correct line in timeline and details views, and Heads Up guidance shows up as simple banner-style callouts.
- [x] [Improved] ⌨️ Moving through a trip takes fewer clicks. Active city cards support keyboard travel with arrow keys or Tab, and Enter or Space can open or close the matching details panel.
- [ ] [Internal] 🧪 Added regression coverage for low-zoom month rails, mobile peek drawers, account-menu trip actions, modal title editing, and planner control behavior.
- [ ] [Internal] 🧷 Added regression coverage to keep mobile viewport state declared before the trip-view callbacks that depend on it.
- [ ] [Internal] 🧪 Added regression coverage for the compact horizontal activity layout, the passive mobile drawer preview, the cleaned-up line tabs, the floating map layer order, and the account-menu/My Trips stacking behavior.
- [ ] [Internal] 📝 The richer profile overview cards are temporarily hidden more broadly than originally planned while we keep the mobile-first profile simplification in place for this pass.
