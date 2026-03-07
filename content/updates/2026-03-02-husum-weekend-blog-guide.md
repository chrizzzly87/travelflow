---
id: rel-2026-03-02-husum-weekend-blog-guide
version: v0.81.0
title: "German Husum weekend guide with interactive map and festival itinerary"
date: 2026-03-02
published_at: 2026-03-02T20:48:15Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Added a German-only Husum weekend guide featuring Krokusblütenfest tips, embedded visuals, an interactive map card, and a linked festival itinerary example."
---

## Changes
- [x] [New feature] 🌸 Added a complete German Husum weekend guide focused on harbor highlights, Krabbenbrötchen, Schloßpark crocus blooms, and practical local tips.
- [x] [Improved] 📸 Replaced placeholder illustrations with realistic AI-generated Husum travel photography using local landmark references and a bright, neutral color profile.
- [x] [Improved] 🗺️ Upgraded the interactive Google Maps card to a wider layout with category-wide spot visibility, simple controls, and direct Google Maps deeplinks for each recommendation.
- [x] [Improved] 🧠 Enhanced the German blog rendering with optimized progressive inline images (lazy loading, responsive sources, captions), a clearer table of contents intro entry, and a highlighted in-app example-trip link card.
- [x] [New feature] 📅 Added a reusable markdown `tf-calendar` component with a downloadable `.ics` schedule bundle for cross-calendar import.
- [x] [Improved] 🎨 Refined the global blog calendar card with localized copy, a toast-style icon badge, and a desktop pop-out layout treatment.
- [x] [Improved] 🧭 Stabilized the blog sidebar as a true right-rail sticky navigation (viewport-capped on desktop) so chapter highlighting reliably follows reading progress.
- [x] [New feature] 🧭 Added a linked Husum Krokusblütenfest 2026 weekend example itinerary so readers can open and reuse the trip structure directly.
- [x] [Fixed] 📱 Reduced the Husum social preview image weight so WhatsApp link previews load more reliably.
- [x] [Improved] ✨ Added a warmer norddeutsch sign-off section at the end of the Husum guide.
- [ ] [Internal] 🧩 Added markdown `tf-map`/`tf-calendar` parsing support, analytics tracking hooks for map/calendar interactions, docs for custom markdown components, and regression tests for parser and example-template runtime loading.
