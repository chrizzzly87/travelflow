---
id: rel-2026-03-01-trip-map-floating-preview-experiment
version: v0.64.0
title: "Trip page floating map preview experiment"
date: 2026-03-01
published_at: 2026-03-01T16:10:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Trip planner now includes an experimental map minimize mode with a draggable floating preview while the calendar expands to full workspace."
---

## Changes
- [x] [New feature] 🗺️ Trip planning now includes a map minimize control that can switch the map into a floating preview and restore it back to the main planner layout.
- [x] [Improved] 🪟 The minimized map now appears as a draggable floating card with a tall 2:3 preview shape, cleaner rounded corners, a fused top grab handle, springy corner snap motion, a strong white frame, and soft depth shadow.
- [x] [Improved] 🎬 Minimize and maximize now animate the same map surface between states so the transition feels continuous instead of reloading.
- [x] [Improved] 📅 When the map is minimized, the calendar workspace now expands to use the full planner area and triggers an automatic timeline fit for easier editing.
- [x] [Fixed] 🧲 Floating preview drag now keeps the grab cursor active from mouse-down and responds more smoothly while moving.
- [x] [Fixed] 🧭 Floating preview snap points now stay at viewport corners while respecting the top navigation offset.
- [x] [Fixed] 🧯 Switching map layout direction no longer auto-zooms the calendar, which reduces noisy history entries and delayed save toasts.
- [x] [Improved] 💾 Floating map preview now restores your last dock mode, snapped position, and chosen preview size after refresh.
- [x] [Improved] ↘️ Floating map now has a top-left resize handle with snapped size presets for faster, stable resizing.
- [ ] [Internal] 📊 Map preview minimize, maximize, and reposition interactions now emit dedicated trip-view analytics events.
- [ ] [Internal] ✅ Added regression coverage for persistent dock transitions, floating handle styling, and resize auto-fit guardrails.
- [ ] [Internal] 🧱 Floating map preview behavior is now isolated in a dedicated beta component with removal notes for quick rollback.
