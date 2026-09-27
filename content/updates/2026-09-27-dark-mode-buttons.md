---
id: rel-2026-09-27-dark-mode-buttons
version: v0.194.0
title: "A calmer, more readable dark mode on the trip page"
date: 2026-09-27
published_at: 2026-09-27T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Primary buttons and the AI chat are readable in dark mode again, transfer lines are softer and connect to their pills, and the floating map no longer stacks duplicate city labels."
---

## Changes
- [x] [Fixed] 🌙 In dark mode, the AI chat's Preview and Send buttons, Copy trip and other primary buttons now have readable labels.
- [x] [Fixed] 🏷️ City labels on the map no longer pile up in two colours after you change the map style.
- [x] [Improved] 🔗 Transfer lines in the calendar and the timeline list are softer and match the transfer pills they connect to.
- [x] [Fixed] 🖼️ The floating map card has a dark frame in dark mode, and its corners line up with the map inside.
- [x] [Fixed] ⌨️ The Preview keyboard shortcut hint stays visible in dark mode.
- [x] [Improved] 🗺️ Map and timeline toggles show clearly which option is on, in both themes, and screen readers now announce it too.
- [x] [Fixed] 🔒 A locked trip's Share button and disabled map controls now look disabled in dark mode, not highlighted.
- [x] [Improved] 🔊 Screen readers announce the AI chat's send and stop buttons in your language.
- [ ] [Internal] 🎨 `.dark` now overrides `--tf-primary` (what Tailwind's `bg-primary`/`text-primary` resolve through), matching the existing `--primary-foreground` flip; guarded by a unit test.
- [ ] [Internal] 🧩 `Button` gained `shortcut` (renders `Kbd`), plus `toggle`, `floating` and `soft` variants; about 50 hand-rolled buttons across the trip view, map controls and trip agent now use it. Documented in `docs/DESIGN_SYSTEM_COMPONENTS.md`.
- [ ] [Internal] 🧹 Mapbox overlay markers skipped `marker.remove()` while the style was unreadable (mid-`setStyle`), leaking the previous style's labels; removal is now unconditional, with a regression test.
- [ ] [Internal] 🎚️ New `--tf-transfer-line` token (solid mix of foreground and card) shared by connector strokes, transfer pill borders and the list-view spine.
- [ ] [Internal] 🏷️ New `tripAgent.send` / `tripAgent.stop` keys in all active locales.
