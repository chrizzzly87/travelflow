---
id: rel-2026-02-10-create-trip-visual-overhaul-labs
version: v0.30.0
title: "Create trip visual overhaul labs"
date: 2026-02-10
published_at: 2026-02-10T08:09:29Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Introduced three standalone create-trip design concepts and linked them from the current page for rapid UX comparison."
---

## Changes
- [x] [Improved] 🧪 Added three `/create-trip/labs/*` routes to evaluate distinct planning UX directions side-by-side.
- [x] [Improved] 🧭 Added a "Classic Card Overhaul" concept focused on a richer, modernized version of the classic flow.
- [x] [New feature] 🖥️ Added a full-width 50/50 split workspace concept with live planning feedback as users edit inputs.
- [x] [New feature] 🗺️ Added a guided "Journey Architect" concept to capture trip intent before handing off to classic generation.
- [x] [Improved] 🔗 Added direct "Design Labs" entry links on `/create-trip` for quick access and visual comparison.
- [x] [Improved] 🔒 Updated the Classic Card concept with destination-level route controls, including roundtrip placement and an optional Route Lock toggle.
- [x] [New feature] ⚙️ Added traveler profile detail customization via responsive desktop dialog and mobile drawer interactions.
- [x] [Improved] 🚆 Added transport preference controls with pace+budget auto-suggestions plus manual override guidance messaging.
- [x] [Improved] 💡 Reworked the right-side panel with actionable trip guidance, compact metrics, and rotating planning insights.
- [x] [Improved] 🏳️‍🌈 Refined the couple easter egg to use an 8px top-to-bottom pride border with hard color stops directly on the responsive settings modal surface.
- [x] [Improved] 🧹 Reduced nested card layers in the Classic Card concept and moved to a wider, cleaner form layout with a sticky snapshot card.
- [x] [New feature] 🧲 Added route-lock drag-and-drop for destination pills so users can define stop order directly in the form.
- [x] [New feature] 🚐 Added camper transport mode with optional vehicle weight input and a dedicated “Vanlife activated 🤙” state.
- [x] [Improved] 🗓️ Added exact-vs-flexible date mode selector with lightweight footer-style date summary for calmer visual hierarchy.
- [x] [Improved] 🎯 Simplified snapshot actions to a single CTA (“Create my trip”) and removed low-value plan-strength/guidance clutter.
- [x] [Improved] 🧭 Upgraded destination search to portal autocomplete behavior and restored seasonal “ideal travel time” tooltips on selected items.
- [x] [Improved] 📅 Reused the original date-range picker UI for exact-date mode to match the main create-trip calendar experience.
- [x] [New feature] ↕️ Reworked route snapshot into a vertical flag timeline with directional line styling, roundtrip loop visuals, and start/end pin highlighting.
- [x] [Improved] 📍 Aligned route timeline connectors/roundtrip loop with measured node positions and added destination pin controls to choose the route start point directly.
- [x] [Improved] 🔐 Limited route connector visuals to Route Lock mode and added clearer direction triangles (including the roundtrip return path).
- [x] [Improved] 🧷 Simplified start-point controls by keeping only pin markers with context-aware native tooltips and switched locked route headlines to unicode arrows.
- [x] [Improved] 📱 Increased mobile density by using two-column grids for traveler setup, trip style, and transport preference sections.
- [ ] [Internal] 🧱 Implemented each lab as an independent page component so one winning concept can be rebuilt cleanly.
