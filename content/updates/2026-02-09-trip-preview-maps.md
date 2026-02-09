---
id: rel-2026-02-09-trip-preview-maps
version: v0.28.0
title: "Real trip routes on homepage cards"
date: 2026-02-09
published_at: 2026-02-09T22:20:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Homepage trip cards now show real route maps with actual city coordinates instead of placeholder graphics."
---

## Changes
- [x] [New feature] 🗺️ Homepage trip cards now display real static route maps showing the actual cities and travel path for each destination.
- [x] [New feature] 🌍 Added detailed trip templates for Japan, Italy, Portugal, Peru, New Zealand, Morocco, and Iceland — each with cities, activities, hotels, and travel segments.
- [x] [Improved] 🏨 Every trip template includes curated hotels, local food recommendations, and insider tips via AI insights.
- [x] [New feature] 🖼️ New CLI tool (`npm run maps:generate`) to regenerate all route map images from trip coordinates.
- [x] [New feature] 🔗 New edge endpoint (`/api/trip-map-preview`) for on-demand map preview generation via URL.
- [ ] [Internal] Split monolithic exampleTrips.ts into modular per-destination template files under data/exampleTripTemplates/.
- [ ] [Internal] Added tsx dev dependency for TypeScript script execution.
- [x] [New feature] 👆 Clicking any homepage trip card now opens the full example itinerary in the planner — explore every city, hotel, and activity.
- [x] [Fixed] 🔢 Corrected city counts on Thailand, Peru, and New Zealand cards to match the actual itineraries.
- [ ] [Internal] Synced Thailand card metadata (26 days, 8 cities) with actual template data.
