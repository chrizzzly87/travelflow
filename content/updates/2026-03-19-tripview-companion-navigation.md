---
id: rel-2026-03-19-tripview-companion-navigation
version: v0.0.0
title: "Trip view becomes a routed trip workspace"
date: 2026-03-19
published_at: 2026-03-19T08:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Turns Trip View into a routed workspace with a header-aware desktop sidebar, shared trip-to-country-to-city context, and dedicated pages for planning, destination context, travel support, weather, budget, and logistics across a multi-country route."
---

## Changes
- [x] [Improved] 🧭 Trip view now opens as a routed workspace with a fixed desktop sidebar and matching mobile toolbar, so `Overview`, `Planner`, `Places`, `Explore`, `Phrases`, and more each get their own clear page.
- [x] [Improved] 🧱 The desktop workspace shell is now header-aware, so the fixed sidebar starts below the Trip header, keeps full-height proportions, and no longer overlaps the main navigation.
- [x] [Improved] 🗂️ The desktop sidebar can now collapse down to icon-only navigation with hover tooltips, and it remembers that preference when you reopen the workspace.
- [x] [Improved] 🗺️ Planner is now one focused workspace where calendar, map, timeline, and right-side stop details live together instead of appearing across every trip screen.
- [x] [Improved] 🌏 Non-planner pages now share a trip, country, and city route context, so places like `Places`, `Weather`, `Budget`, `Travel kit`, `Documents`, `Phrases`, and `Explore` stay in sync without dumping every destination detail at once.
- [x] [Improved] 🗓️ Overview now includes a more legible color-coded route calendar with a highlighted current day, so you can read the trip rhythm without opening the planner first.
- [x] [New feature] 📍 Overview and Places now use the shared Trip map implementation, giving the dashboard a high-level geography view while keeping the detailed editing map inside Planner.
- [x] [New feature] 🧭 The workspace demo now follows a multi-country Southeast Asia route, so destination pages, weather, budgets, phrase packs, and travel support all feel closer to a real long-route trip instead of a single-country mock.
- [x] [Improved] 🧳 The trip modal stays available for core actions like sharing, export, history, and settings while destination knowledge moves into dedicated workspace pages.
- [x] [Improved] 🧭 The trip modal now works more like a trip-actions hub, with a lighter handoff into `Places` instead of trying to be a second destination-info screen.
- [x] [Improved] 🏷️ `Places` now makes trip-specific notes, general destination context, freshness, and demo source treatment much clearer, and its highlight toggles now drive a richer neighborhood-and-stay planning playground.
- [x] [Improved] 🗺️ `Places` city maps now show visual overlay zones, stay anchors, and route-focus paths directly on the shared trip map, so destination layers feel like a real planning surface instead of a text-only legend.
- [x] [Fixed] 🧭 `Places` map overlays now use compact numbered neighborhood markers and a cleaner legend, so district guidance stays readable without stacking full area labels on top of the city map.
- [x] [Fixed] 📍 `Places` neighborhood areas, stay anchors, and route-focus lines now draw as native map overlays and fit cleanly inside the visible viewport, so they stay attached while the map moves instead of floating like screen-space artwork.
- [x] [Fixed] 🧩 `Weather` and other workspace maps now stay inside the shared Google Maps provider flow, so route pages stop crashing with provider errors when the map layer is disabled or still loading.
- [x] [New feature] 📋 `Explore` now includes an activity workflow board with shortlist, planned, booked, and done lanes, so promising ideas can move from research into the itinerary without getting lost.
- [x] [Improved] 🎛️ The new activity board now uses a cleaner kanban layout with safer drag handles and corrected overlay layering, so filters and card menus feel much closer to a polished dashboard tool.
- [x] [Improved] 🪄 The activity board now uses a true floating drag preview with much denser cards and slimmer lanes, making it feel more like a focused task board than a mini details view.
- [x] [Improved] 🎯 Activity dragging now shows explicit drop targets for lanes and between-card insertion, so reordering feels readable instead of guessy.
- [x] [Improved] 🧲 Activity dragging now keeps a visible placeholder slot inside the active lane, so reordering within the same column no longer loses the intended drop position.
- [x] [New feature] 🧰 A new `Travel kit` page keeps checklists, emergency references, cash/adapter prep, and offline-ready trip support close to the route instead of burying them in notes.
- [x] [New feature] 📁 A new `Documents` page keeps passports, insurance, onward-proof notes, and transfer packets together with verification toggles and offline dossier prep for the trip.
- [x] [New feature] 💸 A new `Budget` page keeps scenario-based spend pacing, category filters, and safety buffers visible across the route so cost pressure can shape booking and activity decisions earlier.
- [x] [New feature] ⛅ A new `Weather` page keeps route-aware conditions, sea risk, and timing signals visible stop by stop, so weather starts informing the trip instead of sitting outside the workspace.
- [x] [Improved] 📐 The shared workspace layout now uses calmer section spacing, tab-based route context, and fewer nested panel containers, so pages like `Places`, `Weather`, and `Budget` feel lighter and easier to scan.
- [x] [Improved] 🌦️ `Weather` now reads more like a modern forecast workspace, with compact stop widgets, duotone weather icons, and a simple trend graph instead of generic stacked info blocks.
- [x] [Improved] 💱 Travel support and budget tools now include a real-input currency converter, making the demo workspace feel more operational instead of button-driven.
- [ ] [Internal] 🧩 Pulled the latest shared map-runtime foundation into the Trip Workspace branch and reconciled the routed workspace maps, loaders, and modal handoff with the new dual-provider setup before preview deployment.
- [ ] [Internal] 🧪 Added routed workspace regression coverage for sidebar persistence, planner-only routing, SEA route-context behavior, phrase interactions, Explore workflow board behavior, locale wiring, and analytics hooks for the new Trip Workspace flow.
