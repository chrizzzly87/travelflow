---
id: rel-2026-09-29-my-location-on-trip-map
version: v0.204.0
title: "See yourself on the trip map"
date: 2026-09-29
published_at: 2026-09-29T12:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "While you're on your trip, the map can show where you are and bring you back to your position with one tap."
---

## Changes
- [x] [New feature] 📍 While you're on a trip, or in one of its countries, the trip map can show a live dot for where you are right now.
- [x] [New feature] 🎯 A locate button takes you back to your position. It turns blue when you have scrolled away from yourself.
- [x] [Improved] 💾 Once you turn it on, your device remembers the choice, so your dot is back the next time you open the trip. Your last known position appears grey until a fresh one arrives.
- [x] [Improved] 🔒 Your position stays on your device and is never sent to TravelFlow. Turn it off any time under "My location" in the map settings.
- [ ] [Internal] New `userLocationService` wraps the browser's geolocation watch (it only runs while a map is open and the tab is visible). A new registered storage key, `tf_user_location_v1`. The trip-running / IP-country check lives in `shouldOfferUserLocation`. Unit tests cover the service and the check.
