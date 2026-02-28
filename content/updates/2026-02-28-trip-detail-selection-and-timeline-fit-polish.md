---
id: rel-2026-02-28-trip-detail-selection-and-timeline-fit-polish
version: v0.68.0
title: "Trip Detail Selection + Timeline Fit Polish"
date: 2026-02-28
published_at: 2026-02-28T06:57:40Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Trip detail interactions now highlight selections more clearly, history is fully scrollable, timeline zoom auto-fits better, and auth now handles slow/offline networks more clearly."
---

## Changes
- [x] [Improved] 🔵 Selected activities and transfer cards now keep a clear blue outline so selection stays obvious.
- [x] [Improved] 📜 Change history now scrolls properly, so long edit sessions remain fully visible.
- [x] [Improved] 📐 Timeline zoom now auto-fits the available space on first load and when switching timeline orientation.
- [x] [Improved] 🧠 After you manually change timeline zoom, your zoom is kept for the rest of the session and no longer auto-adjusted.
- [x] [Improved] 🛣️ Removed the dark route border treatment so lines and route arrows look cleaner on the map.
- [x] [Improved] ⏱️ Login now times out gracefully when authentication takes too long, with clearer retry guidance for slow connections.
- [x] [Improved] 📶 The app now shows a global offline status and keeps checking automatically so cloud syncing can resume as soon as you are back online.
