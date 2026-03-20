---
id: rel-2026-03-19-tripview-companion-navigation
version: v0.0.0
title: "Trip view becomes a routed trip workspace"
date: 2026-03-19
published_at: 2026-03-19T08:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Turns Trip View into a routed workspace with a fixed desktop sidebar, focused planner page, and dedicated pages for destination context, exploration, phrases, and trip logistics."
---

## Changes
- [x] [Improved] 🧭 Trip view now opens as a routed workspace with a fixed desktop sidebar and matching mobile toolbar, so `Overview`, `Planner`, `Places`, `Explore`, `Phrases`, and more each get their own clear page.
- [x] [Improved] 🗂️ The desktop sidebar can now collapse down to icon-only navigation with hover tooltips, making the workspace feel more like a compact dashboard when you want extra canvas space.
- [x] [Improved] 🗺️ Planner is now one focused workspace where calendar, map, timeline, and right-side stop details live together instead of appearing across every trip screen.
- [x] [Improved] 🗓️ Overview now includes a color-coded route calendar with a highlighted current day, so you can read the trip rhythm without opening the planner first.
- [x] [New feature] 📍 Overview also gets its own compact route map, giving the dashboard a high-level geography view while the detailed editing map stays inside Planner.
- [x] [New feature] 🇹🇭 Dedicated Thailand demo pages now cover destination context, discovery ideas, bookings, notes, photos, and phrase flashcards while live data integrations are still being wired in.
- [x] [Improved] 🧳 The trip modal stays available for core actions like sharing, export, history, and settings while destination knowledge moves into dedicated workspace pages.
- [ ] [Internal] 🧪 Added routed workspace regression coverage, locale wiring, and analytics hooks for the new Trip Workspace flow.
