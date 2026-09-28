---
id: rel-2026-09-28-day-trips-on-previews
version: v0.199.0
title: "Day trips on trip previews"
date: 2026-09-28
published_at: 2026-09-28T13:09:09Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Day trips now show up on trip card maps, shared link previews and the stay bar under every trip card."
---

## Changes
- [x] [Improved] 🧭 Trip card maps now show your day trips: a dashed line from the stay out to the destination, with its own pin.
- [x] [Improved] 🔗 Shared trip links preview your day trips too, with the destinations named next to the trip's length and distance.
- [x] [New feature] 📍 The stay bar under each trip card marks every day trip with a small dot on its stay; hover it to see where you went.
- [x] [Improved] 🦌 The Japan example trip now stays five days in Osaka, with day trips to Nara and Kobe and tips for each.
- [x] [Improved] 🗺️ The example trip maps on the homepage show their day trips, like Miyajima, the Golden Circle and Sintra.
- [ ] [Internal] Added a `dayTrips` parameter to the card map preview URL and its CDN cache key; trips without day trips keep their existing cached images.
- [ ] [Internal] `shared/activityStay.ts` now uses structural types so edge functions can share the stay resolver.
- [ ] [Internal] Static map previews fall back to straight legs when routed geometry would exceed Google's URL limit, which also fixes regenerating the South East Asia homepage map.
