---
id: rel-2026-03-19-tripview-companion-navigation
version: v0.0.0
title: "Trip view becomes a routed trip workspace"
date: 2026-03-19
published_at: 2026-03-19T08:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Turns Trip View into a routed workspace with a header-aware desktop sidebar, focused planner page, shared-map overview cards, and dedicated pages for planning, destination context, travel support, weather, budget, and logistics."
---

## Changes
- [x] [Improved] 🧭 Trip view now opens as a routed workspace with a fixed desktop sidebar and matching mobile toolbar, so `Overview`, `Planner`, `Places`, `Explore`, `Phrases`, and more each get their own clear page.
- [x] [Improved] 🧱 The desktop workspace shell is now header-aware, so the fixed sidebar starts below the Trip header, keeps full-height proportions, and no longer overlaps the main navigation.
- [x] [Improved] 🗂️ The desktop sidebar can now collapse down to icon-only navigation with hover tooltips, and it remembers that preference when you reopen the workspace.
- [x] [Improved] 🗺️ Planner is now one focused workspace where calendar, map, timeline, and right-side stop details live together instead of appearing across every trip screen.
- [x] [Improved] 🗓️ Overview now includes a more legible color-coded route calendar with a highlighted current day, so you can read the trip rhythm without opening the planner first.
- [x] [New feature] 📍 Overview and Places now use the shared Trip map implementation, giving the dashboard a high-level geography view while keeping the detailed editing map inside Planner.
- [x] [New feature] 🇹🇭 Dedicated Thailand demo pages now cover destination context, discovery ideas, bookings, notes, photos, and interactive phrase flashcards while live data integrations are still being wired in.
- [x] [Improved] 🧳 The trip modal stays available for core actions like sharing, export, history, and settings while destination knowledge moves into dedicated workspace pages.
- [x] [Improved] 🧭 The trip modal now works more like a trip-actions hub, with a lighter handoff into `Places` instead of trying to be a second destination-info screen.
- [x] [Improved] 🏷️ `Places` now makes trip-specific notes, general destination context, freshness, and demo source treatment much clearer, and its highlight toggles now drive a richer neighborhood-and-stay planning playground.
- [x] [New feature] 📋 `Explore` now includes an activity workflow board with shortlist, planned, booked, and done lanes, so promising ideas can move from research into the itinerary without getting lost.
- [x] [Improved] 🎛️ The new activity board now uses a cleaner kanban layout with safer drag handles and corrected overlay layering, so filters and card menus feel much closer to a polished dashboard tool.
- [x] [Improved] 🪄 The activity board now uses a true floating drag preview with much denser cards and slimmer lanes, making it feel more like a focused task board than a mini details view.
- [x] [Improved] 🎯 Activity dragging now shows explicit drop targets for lanes and between-card insertion, so reordering feels readable instead of guessy.
- [x] [Improved] 🧲 Activity dragging now keeps a visible placeholder slot inside the active lane, so reordering within the same column no longer loses the intended drop position.
- [x] [New feature] 🧰 A new `Travel kit` page keeps checklists, emergency references, cash/adapter prep, and offline-ready trip support close to the route instead of burying them in notes.
- [x] [New feature] 📁 A new `Documents` page keeps passports, insurance, onward-proof notes, and transfer packets together with verification toggles and offline dossier prep for the trip.
- [x] [New feature] 💸 A new `Budget` page keeps scenario-based spend pacing, category filters, and safety buffers visible across the route so cost pressure can shape booking and activity decisions earlier.
- [x] [New feature] ⛅ A new `Weather` page keeps route-aware conditions, sea risk, and timing signals visible stop by stop, so weather starts informing the trip instead of sitting outside the workspace.
- [ ] [Internal] 🧪 Added routed workspace regression coverage for sidebar persistence, planner-only routing, phrase interactions, Explore workflow board behavior, locale wiring, and analytics hooks for the new Trip Workspace flow.
