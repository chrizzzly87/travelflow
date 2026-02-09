---
id: rel-2026-02-09-homepage-redesign
version: v0.23.0
title: "View transitions, country pages, and blog & homepage redesign"
date: 2026-02-09
published_at: 2026-02-09T12:00:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Smooth page transitions, country-specific inspiration pages, interactive month calendar, smarter festivals, a markdown-powered blog, and a redesigned homepage."
---

## Changes
- [x] [New feature] 📅 Interactive month calendar — pick any month to discover the best destinations and seasonal travel tips.
- [x] [New feature] 🎉 Upcoming festivals — events now show in chronological order with their next date, so you never miss one.
- [x] [New feature] 📝 Blog — travel planning guides, destination deep-dives, and tips, powered by markdown.
- [x] [New feature] 🔗 Related articles appear throughout inspirations for deeper reading.
- [x] [Improved] 🗓️ 20+ festivals with real dates for accurate upcoming-event sorting.
- [x] [New feature] 🏠 Completely redesigned homepage with a bold hero, feature showcase, and bottom call-to-action.
- [x] [New feature] 🧭 New Features page with three hero capabilities, "How it works" steps, a 9-feature grid, and a comparison table against other planning tools.
- [x] [New feature] 🌍 New Inspirations page with 18+ curated destinations across 6 travel themes — adventure, food & culture, beaches, cities, slow travel, and photography trips.
- [x] [New feature] 🔍 Search across all destinations, festivals, and weekend getaways from the Inspirations page.
- [x] [New feature] 🗺️ Browse by country with best-month recommendations and tags for 12 popular destinations.
- [x] [New feature] ⚡ Spontaneous weekend getaway picks — 6 short-trip ideas you can book on a whim.
- [x] [New feature] 🎠 Browse a scrolling gallery of example trips on the homepage — hover to pause, click to explore.
- [x] [Improved] 🎞️ Sections animate smoothly into view as you scroll — blur reveals, directional slides, and staggered entrances.
- [x] [Improved] 🎨 Trip creation form feels more premium with refined card shadows, a glowing accent bar, and softer background effects.
- [x] [Improved] 🚀 Pages transition smoothly with the View Transition API — a fast, subtle slide animation between routes.
- [x] [Fixed] 📍 Navigating between pages now always starts at the top of the page.
- [x] [New feature] 🇯🇵 Country detail pages — click any country card to see travel info, best months, and tags at a glance.
- [x] [Fixed] 📑 Release notes now always display in the correct chronological order.
- [ ] [Internal] Added blog service layer, validation script, and 5 example blog posts.
- [ ] [Internal] Added /blog/:slug route and blog post detail page with ReactMarkdown rendering.
- [ ] [Internal] Enhanced FestivalEvent interface with startMonth, startDay for date-aware sorting.
- [ ] [Internal] Added blogSlugs references across inspiration data types.
- [ ] [Internal] Added content-fade-in CSS animation for month tab transitions.
- [ ] [Internal] Adopted Phosphor Icons (duotone) on marketing pages and create-trip form.
- [ ] [Internal] Added CSS scroll-driven animation utilities and @phosphor-icons/react dependency.
- [ ] [Internal] Added ScrollToTop and ViewTransitionHandler components in App.tsx.
- [ ] [Internal] Added view transition CSS keyframes (vt-slide-out/vt-slide-in) for ::view-transition pseudo-elements.
- [ ] [Internal] Added /inspirations/country/:countryName route and CountryDetailPage.
