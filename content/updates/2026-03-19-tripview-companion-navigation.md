---
id: rel-2026-03-19-tripview-companion-navigation
version: v0.0.0
title: "Trip view becomes a routed trip workspace"
date: 2026-03-19
published_at: 2026-03-19T08:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Turns Trip View into a routed workspace with a header-aware desktop sidebar, focused planner page, shared-map overview cards, and dedicated pages for destination context, exploration, phrases, and trip logistics."
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
- [ ] [Internal] 🧪 Added routed workspace regression coverage for sidebar persistence, planner-only routing, phrase interactions, locale wiring, and analytics hooks for the new Trip Workspace flow.
