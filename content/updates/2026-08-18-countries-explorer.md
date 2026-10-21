---
id: rel-2026-08-18-countries-explorer
version: v0.161.0
title: "Find your country by month, not by scrolling"
date: 2026-08-18
published_at: 2026-08-18T10:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The country overview now has search, filters, and a month picker that reshapes every card."
---

## Changes
- [x] [New feature] 🗓️ Pick the month you want to travel and every country card shows the typical temperature, how wet it gets, and how busy that month usually is.
- [x] [New feature] 🔎 Type-ahead search finds a country by name, local name, region or travel style — accents optional, so "Turkiye" finds Türkiye.
- [x] [New feature] 🧭 Filter by region, travel style and trip length, all at once, with a live count and a one-tap reset.
- [x] [Improved] 📊 Every card now carries a twelve-month bar showing the best, in-between and weaker months at a glance.
- [x] [Improved] 🔗 Your search, filters and chosen month live in the link, so a filtered view can be shared and the back button works as expected.
- [x] [Improved] 🧹 Removed the suggested trip length badge from the overview cards to make room for timing information that helps you choose.
- [ ] [Internal] 🧮 Added an in-repo scored fuzzy matcher (prefix, substring, subsequence, weighted fields) instead of adding a search dependency.
- [ ] [Internal] 🧵 Explorer state is a pure reducer serialized to the query string, keeping the page effect-free and leaving room for a future map to drive the same state.
- [ ] [Internal] 🌤️ Cards degrade to the curated seasonality band and omit climate figures while the climate dataset coverage is still partial.
- [ ] [Internal] ✅ Added unit coverage for the matcher, the filter reducer, the URL round trip, and the missing-climate fallback.
