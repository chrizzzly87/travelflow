---
id: rel-2026-09-26-trip-view-only-polish
version: v0.191.0
title: "Dark mode on the trip page, tidier view-only trips"
date: 2026-09-26
published_at: 2026-09-26T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Switch between light and dark right from the trip page, and shared view-only trips no longer show buttons you cannot use."
---

## Changes
- [x] [Improved] 🌙 The trip page now has its own light and dark switch on larger screens, next to your account menu — no detour to another page needed.
- [x] [Improved] 👀 Shared view-only trips no longer show "add city", "add transfer" or "add activity" buttons you could never press. The timeline stays clean for people who can only look.
- [x] [Improved] ➕ The add buttons in the horizontal timeline now sit right beside their row label and look the same for cities and transfers, in light and dark mode.
- [x] [Fixed] 🎨 Switching between light and dark now changes the whole page at once, instead of some buttons and labels lagging a moment behind in the old colours.
- [x] [Fixed] 🧱 On example trips, the "Plan with AI" button no longer covers the example banner's buttons — the banner now sits just above it.
- [x] [Fixed] 📋 The "Copy trip" button on a view-only shared trip is readable again in dark mode.
- [ ] [Internal] 🧪 Added regression tests for read-only add buttons in both timelines, the trip header theme toggle, the theme-flip transition guard and the example banner placement.
