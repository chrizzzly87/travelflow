---
id: rel-2026-09-16-mobile-transport-and-same-day-moves
version: v0.169.0
title: "Change transport on your phone, and days that hold a whole move"
date: 2026-09-16
published_at: 2026-09-16T16:52:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Switch how you travel a leg straight from your phone, see a move that happens inside one day on that day, add an activity without leaving the day you are reading, and tap a day only once to open it."
---

## Changes
- [x] [New feature] 🚄 Change how you travel any leg from your phone — the same nine options the desktop planner offers, one tap each.
- [x] [Fixed] 🌗 A move that happens inside a single day now shows on that day. Leaving one city after lunch and reaching the next by evening used to be split across two days, and the arrival could vanish completely.
- [x] [New feature] ➕ Add an activity to the day you are looking at without leaving it — write it yourself or let the AI planner suggest it.
- [x] [Improved] 🟢 The day you travel is marked on the day strip itself: the ring runs from the colour of the city you leave to the colour of the one you reach, with the transport on its edge.
- [x] [Improved] 🗓️ The day-by-day switch finally looks like a calendar.
- [x] [Fixed] 👆 Tapping a day now opens that day. Picking a day in a city you were not already in used to jump to that city's first day, so every day needed two taps.
- [x] [Fixed] 🔍 Double-tapping a card no longer zooms the page in, which was easy to trigger by accident and awkward to undo.
- [x] [Improved] 🏙️ Choosing a city now flies in close enough to see the city itself, and the marker is smaller so it no longer covers the centre it just framed.
- [x] [Improved] ✅ A selected activity now reads as a proper card — full width, padded and outlined — instead of a stripe of colour behind the text.
- [ ] [Internal] 🧮 Days resolve their stays by overlapping the day's own interval rather than rounding each stay to whole days, which is what dropped a stay whenever two shared the day of a move.
- [ ] [Internal] ⏱️ Added `toIntervalEndDay`, because `toDayOffset` rounds a boundary up and so reported a stay ending at offset 3 as ending on day 3 rather than day 2.
- [ ] [Internal] 🧩 A day now carries `legs` with a role — handover, departure or arrival — instead of a single arrival and a single departure, so an overnight leg and a same-day move can read differently.
- [ ] [Internal] 🎛️ The mobile transport modal writes the same patch as the details-panel picker, so a leg edited on a phone is indistinguishable from one edited on a desktop.
- [ ] [Internal] 🎯 The day panel only follows a selection the shown day does not already contain; following every selection sent the strip back to the first day of the stay a tap had just selected.
- [ ] [Internal] 🗺️ Raised `cityFocusZoom` on both providers and inverted the high-zoom city marker scale bands, which previously grew the marker as the camera closed in.
- [ ] [Internal] 🧪 Regression coverage for same-day handovers, whole-day boundary legs, overnight splits, hotel check-in/out across a handover, the transport modal write, the quick-add wiring and the read-only case.
