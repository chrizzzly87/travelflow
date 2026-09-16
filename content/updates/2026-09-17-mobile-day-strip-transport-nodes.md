---
id: rel-2026-09-17-mobile-day-strip-transport-nodes
version: v0.170.0
title: "Every journey back on the day strip, and cleaner day circles"
date: 2026-09-17
published_at: 2026-09-17T16:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Each journey has its own stop on the day strip again and opens the transport picker in one tap, the day circles no longer have the strip's line running through them, a day spent in three cities shows all three, and the map opens on the place itself without city labels."
---

## Changes
- [x] [Fixed] 🚆 Every journey has its own stop on the day strip again, with its own transport icon — a move that happens inside one day is no longer squeezed onto the edge of a day circle.
- [x] [New feature] 🎛️ Tap that transport icon to change how you travel the leg, straight from the strip.
- [x] [Fixed] 🎯 The line joining your days no longer runs through the day circles. The circles are filled now, so the route reads as a line of stops rather than a line crossed by rings.
- [x] [Fixed] 🏙️ A day spent in three cities shows all three on its circle. Only the first and last used to appear, and the city in the middle vanished from the strip entirely.
- [x] [Improved] 🔍 Picking a city on the map now lands on the city itself, close enough to see where you actually are, and an activity closer still.
- [x] [Improved] 🧭 City labels start switched off, so the map opens on your route instead of a page of names. Turn them back on any time — if you already had them on, they stay on.
- [ ] [Internal] 🧱 A day carries every stay it touches in travel order, so the circle's ring is painted from the stays themselves instead of a first-and-last pair.
- [ ] [Internal] 🎨 The ring is a border-box gradient over an opaque padding-box fill; the previous bare border left the ring's inner gap transparent, which is what let the connecting line through.
- [ ] [Internal] ↔️ The ring gradient follows the document direction, so a split day reads the same way round in RTL.
- [ ] [Internal] 🔗 Strip links resolve by shared stay and carry that stay's colour, replacing a comparison of each day's final city that could not see a stay continuing through a move.
- [ ] [Internal] 🧪 Coverage for the per-leg nodes, the three-stay day, the ring layers in both selected and unselected states, and the picker opening from the strip in editable and read-only trips.
