---
id: rel-2026-09-16-trip-view-mobile-redesign
version: v0.168.0
title: "A trip view built for the phone, and route maps that follow real roads"
date: 2026-09-16
published_at: 2026-09-16T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "On a phone the map now fills the screen with a day-by-day panel over it, and trip cards trace the roads you will actually drive."
---

## Changes
- [x] [New feature] 📱 On a phone the trip map now fills the screen, with your days as a row of round buttons over it — tap a day to jump the map and the panel straight to it.
- [x] [New feature] ↕️ Drag the panel's handle to size it, or use the single arrow to grow it to full screen and collapse it again — with a mouse as well as a finger.
- [x] [New feature] 🚆 The day strip now reads as your route: days in one city share a coloured line, and a change of city is its own stop showing the transport, the departure time and how long the leg takes.
- [x] [New feature] 🛎️ Each day opens with its fixed points — when you arrive and from where, when you leave and how long it takes, and hotel check-in and check-out.
- [x] [New feature] ➡️ Every activity has a directions button. On Android your phone asks which map app to use, on iPhone you pick Apple Maps or Google Maps, and on a computer it opens in a new tab.
- [x] [Improved] 🧭 "Fit to itinerary" finally frames your trip on a phone instead of zooming out to the whole world with the city names piled on top of each other.
- [x] [New feature] 🏷️ A one-tap button on the map turns the stop labels off when they crowd the route, and back on when you need them.
- [x] [Improved] 🛣️ Trip cards and example trips now draw the real driving route between stops instead of a straight line across the map.
- [x] [Improved] 🎛️ The calendar and zoom controls no longer float over the map on a phone, so the map's own menus open where you can read them.
- [x] [Fixed] 🔎 Wherever the map sits in a short panel, the itinerary is framed with room to breathe rather than squeezed out of view.
- [x] [Fixed] 🗓️ Closing a day no longer loses your place, and tapping a stop on a phone no longer slides a second panel over the one you are reading.
- [x] [Fixed] 🏨 A stay that begins the same day another one ends now shows its arrival and its hotel check-in instead of skipping them.
- [x] [Improved] 👋 The example-trip notice now sits out of the way on a phone and can be dismissed.
- [ ] [Internal] 🗺️ Mapbox previews now request driving geometry from Mapbox Directions first and only fall back to Google, so a deployment without a Google key no longer silently degrades every preview to straight lines.
- [ ] [Internal] 📏 Static Mapbox previews fall back to straight-line overlays when realistic geometry would push the request past the provider's URL limit.
- [ ] [Internal] 🚦 Raised the preview rate-limit bucket and lowered the realistic-route cost so a full card grid can request realistic routes without hitting 429s.
- [ ] [Internal] 📐 Fit padding is clamped to the map pane so a pane always keeps a usable strip of map, and the fit reads the live container rect instead of a possibly stale observed size.
- [ ] [Internal] 🧱 Added a per-day trip model and a mobile planner shell, and sized the mobile map element to the visible area so camera fits are computed against what is actually on screen.
- [ ] [Internal] 🧮 Stay day-ranges are now resolved as one contiguous sequence; rounding each stay independently let two claim the same calendar day, so the later one never reported an arrival.
- [ ] [Internal] 🖱️ The day strip and the sheet handle are driven by pointer events, so click-and-drag works on a desktop pointer and a drag no longer fires the control it started on.
- [ ] [Internal] 🚪 `useTripSelectionController` takes a `detailsPanelEnabled` flag; mobile turns the panel off entirely rather than relying on clear-on-close, which was dropping the selection.
- [ ] [Internal] 🧪 Regression coverage for the day model and its strip nodes, overlapping stay ranges, arrival-time and overnight maths, hotel check-in/out, the mobile sheet snaps and controls placement, the disabled details panel, Mapbox realistic routes with and without a Google key, and phone-sized fit padding.
- [ ] [Internal] 🧭 Directions use the `geo:` scheme on Android, which is what triggers the system app chooser; iOS has no equivalent, so the choice is offered in-app. Activities without coordinates fall back to a place query qualified by their city.
- [ ] [Internal] 📝 `react-doctor` is documented as an optional check rather than a merge gate.
