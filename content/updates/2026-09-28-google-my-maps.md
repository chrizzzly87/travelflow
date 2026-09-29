---
id: rel-2026-09-28-google-my-maps
version: v0.198.0
title: "Your Google My Maps, and your ideas on the map"
date: 2026-09-28
published_at: 2026-09-28T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Import a Google My Maps map into a trip, review its places right on the map, and download a trip as a map file for My Maps."
---

## Changes
- [x] [New feature] 📍 Paste a Google My Maps link and its pins land in your trip ideas, ready to plan onto a day.
- [x] [New feature] 💡 Show your trip ideas on the map with one tap: new, unreviewed ideas appear faded, and ideas you save show in full.
- [x] [New feature] 🗨️ Tap an idea on the map to see its details, links and directions, and save or skip it right there.
- [x] [New feature] ✅ Save or skip imported ideas from the map or the ideas list; skipped ones leave the map and stay out of later imports.
- [x] [New feature] 🗂️ Upload a KML or KMZ file from My Maps when a map isn't shared publicly.
- [x] [New feature] 🗺️ Download your trip as a map file for Google My Maps, with separate layers for the route, stops, activities, day trips and ideas.
- [x] [Improved] 🔎 Pins saved with only an address are found on the map automatically while importing.
- [x] [Improved] ♻️ Importing the same map again only adds what's new, and skips places you've already planned.
- [x] [Fixed] 🏷️ Pin names on the map now appear right above the pin you point at, on top of neighbouring pins.
- [x] [Fixed] ☁️ Ideas you save are now stored with your trip, so they show up on every device and survive a reload.
- [ ] [Internal] Import and export live in the trip details dialog; the tab is now called Import & export for editors.
- [ ] [Internal] KML parsing, a dependency-free KMZ reader and the trip KML writer, covered by unit tests with a synthetic My Maps fixture.
- [ ] [Internal] New analytics events for the My Maps export, load, add, error and open-ideas actions, the ideas map toggle, idea pin opens and keep/skip decisions.
- [ ] [Internal] Idea changes (deck swipes, imports, keep/skip) now go through the trip commit, not only the local save; ideas that only reached one device are written back once when the trip opens there.
- [ ] [Internal] Saved ideas carry an optional review state (to review / skipped); the ideas layer's on/off choice is remembered per trip in a registered browser key.
