---
id: rel-2026-09-21-mobile-dark-mode-fixes
version: v0.187.0
title: "The planner in the dark, on a phone"
date: 2026-09-21
published_at: 2026-09-21T17:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Dark mode now reaches the parts of the planner it was missing on a phone: the day circles, the loading screen and the marker for today. The map sheet keeps its buttons on screen, saving your own map look sticks, and the trip page finally has a menu."
---

## Changes
- [x] [Fixed] 🌙 The day circles along the bottom of the planner are dark inside again instead of glowing white discs on a dark screen.
- [x] [Fixed] 🦴 The loading screen you see while a trip opens is now dark all the way through — it used to come up as a white page with dark shapes on it.
- [x] [Fixed] 📅 Today is marked the same way everywhere now, and it reads properly in the dark. The big timeline no longer paints a pale column down the middle or covers the date with its own label.
- [x] [Fixed] 🎚️ The map's customise sheet keeps Reset, Copy and Save on screen on a phone. They were being cut off below the bottom edge, and they now stay on one line instead of stacking — the save button is simply "Save", with the longer wording moved to its tooltip.
- [x] [Fixed] ⭐ Picking your own saved map look now sticks. It used to flick straight back to Default unless you passed through another preset first.
- [x] [New feature] 🧭 The trip page has a menu, so you can reach the rest of the app from the planner on a phone without going back to the homepage first. It sits at the far right of the header, in the same place as everywhere else in the app.
- [x] [Improved] 📱 The installed app's top strip now matches the app's own header instead of showing a strip of a different colour above it.
- [ ] [Internal] 🎨 Added --tf-today-* and --tf-boot-* palette tokens with light and dark values, replacing per-site literals and /12 alpha arithmetic; one shared TodayBadge replaces four ad-hoc pills.
- [ ] [Internal] 📐 The bottom drawer primitive is a flex column with overflow hidden, so a capped sheet can no longer push its footer past its own max-height.
- [ ] [Internal] 🔖 The saved map preset is now tracked as an explicit selection, because it does not carry routeMode/showCityNames/colorMode and therefore cannot be derived from the resolved preferences.
- [ ] [Internal] 🧪 Added regression coverage for the preset selection, the sheet height cap, the trip-header menu, the dark boot-shell palette and the theme-colour meta sync.
