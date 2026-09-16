---
id: rel-2026-09-17-mobile-day-strip-transport-nodes
version: v0.170.0
title: "Every journey on the day strip, and a day of travel shown in both cities"
date: 2026-09-17
published_at: 2026-09-17T16:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "A day you travel now appears twice — once in the city you leave and once in the one you reach — with the journey between them, its duration on it, and one tap to set how you travel it, even on a leg that never had transport."
---

## Changes
- [x] [New feature] 🔁 A day you change city now appears twice on the day strip: once in the city you leave and once in the one you reach, with the journey between them. You can see what you are doing in each city instead of reading half a circle of each colour.
- [x] [Fixed] 🚆 Every journey has its own stop on the strip again, with its own transport icon — no longer squeezed onto the edge of a day circle.
- [x] [New feature] 🎛️ Tap a journey to set how you travel it. This now works on journeys that never had any transport: picking a mode creates it instead of doing nothing.
- [x] [Fixed] ⏱️ Every journey shows its duration, and says n/a when it does not have one yet, so a leg still to be planned is visible rather than blank.
- [x] [Fixed] 🎯 The line joining your days no longer runs through the day circles.
- [x] [Improved] 🔍 Picking a city on the map lands on the city itself, close enough to see where you are, and an activity closer still.
- [x] [Improved] 🧭 City labels start switched off, so the map opens on your route instead of a page of names. Turn them back on any time — if you already had them on, they stay on.
- [ ] [Internal] 🧱 The strip walks city-days rather than days: `buildMobileDayPlanSegments` splits each day into one segment per stay it touches, with the day's activities, hotel events and legs resolved to the stay they belong to.
- [ ] [Internal] 🔗 A leg gets exactly one node, between the two segments it joins, which covers a same-day move and an overnight leg through the same rule and retires the handover badge.
- [ ] [Internal] 🆕 `handleSetLegTransport` writes a leg's transport by stay pair, creating the travel item when the leg has none; the mobile picker works on the leg rather than on an item id.
- [ ] [Internal] 🎨 The circle is a border-box gradient over an opaque padding-box fill; the previous bare border left the ring's inner gap transparent, which let the connecting line through.
- [ ] [Internal] 🧪 Coverage for the per-city split of a travel day, the activity and hotel split across it, a three-city day, the per-leg nodes, the n/a duration, and the picker writing a leg with and without an existing item.
