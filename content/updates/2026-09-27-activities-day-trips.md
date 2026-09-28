---
id: rel-2026-09-27-activities-day-trips
version: v0.197.0
title: "Day trips, and activities that know their stay"
date: 2026-09-27
published_at: 2026-09-27T12:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Plan day trips that leave your stay and come back the same day, see them on the map with their own route, and add activities from one tidy button."
---

## Changes
- [x] [New feature] 🧭 Plan day trips: mark an outing like Sintra from Lisbon as a day trip and it gets its own marker and a dashed route out and back on the map.
- [x] [New feature] 🏨 Every activity now belongs to a stay, and you can move it to another stay and day right from its details.
- [x] [New feature] ✨ New AI-planned trips suggest day trips from your bases instead of squeezing them in as extra stops.
- [x] [New feature] 💬 The trip assistant can add, change and remove day trips for you.
- [x] [Improved] ➕ The calendar's activities row has a single add button, like stays and transfers, and starts on the stay you have selected.
- [x] [Improved] 🔁 A day trip can end in a different stay when your plans need it, tucked away under more options.
- [x] [Improved] 🗺️ Example trips now show their classic day trips on the map, and the Portugal road trip visits Sintra as a day trip from Lisbon.
- [ ] [Internal] Added optional `stayCityId`, `activityKind` and `dayTripReturnCityId` item fields with one shared stay resolver, replacing three date-window copies.
- [ ] [Internal] Added a top-level `dayTrips` list to the itinerary schemas and prompts, a forgiving preparation step, and one shared placement builder for the worker, client and benchmark parsers.
- [ ] [Internal] The AI benchmark reports day-trip counts and downgraded day trips as non-blocking checks.
- [ ] [Internal] Trip Agent schemas accept stay and day-trip fields plus the location resolver's provenance fields; unknown city references are rejected with a fixable hint.
- [ ] [Internal] Documented the model and every affected surface in `docs/ACTIVITIES_AND_DAY_TRIPS.md`.
