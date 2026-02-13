---
id: rel-2026-02-10-example-trip-playground-and-anonymous-limits
version: v0.34.0
title: "Example trip playground improvements"
date: 2026-02-10
published_at: 2026-02-10T18:50:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Example trips now feel more like an interactive playground, with clearer guided actions and a polished reactivation experience."
---

## Changes
- [x] [New feature] 🧭 Added dedicated `/example/:templateId` routes so example trip links stay reliable across tabs and incognito sessions.
- [x] [Improved] 🪧 Refined the sticky example-trip banner with clearer guidance and stronger copy/create actions.
- [x] [Improved] 🧪 Example trips now run in true playground mode where exploration changes are never saved.
- [x] [Improved] 📚 Example trips now open with destination info collapsed for a cleaner first view.
- [x] [Fixed] ↩️ Browser Back now returns correctly when opening and leaving `/example/*` trips from homepage cards.
- [x] [Improved] ✨ Expired-trip screens now provide a richer reactivation flow with clearer activation and FAQ paths.
- [x] [Improved] 🧩 Expired previews now use consistent placeholder destination names across planner, print, and My Plans tooltip previews.
- [x] [Improved] 📱 Mobile trip info/share surfaces now open as bottom-aligned sheets for easier one-hand use.
- [x] [Improved] 🔗 Inactive shared links now open a clear “link unavailable” page instead of silently redirecting.
- [ ] [Internal] 🧱 Added lifecycle/paywall infrastructure (`active`, `expired`, `archived`) and centralized paywall checks.
- [ ] [Internal] 📊 Added analytics events for example-trip interactions and expired-trip reactivation/FAQ actions.
- [ ] [Internal] 📄 Added brand and paywall implementation guidelines for consistent future updates.
