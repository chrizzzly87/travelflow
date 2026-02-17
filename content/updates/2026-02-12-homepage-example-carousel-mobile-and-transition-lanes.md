---
id: rel-2026-02-12-homepage-example-carousel-mobile-and-transition-lanes
version: v0.44.0
title: "Homepage example carousel mobile fix and transition lanes"
date: 2026-02-12
published_at: 2026-02-13T20:50:33Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Stabilized the homepage example carousel on mobile and upgraded example cards with timeline lane visuals plus smoother card-to-trip transitions."
---

## Changes
- [x] [Fixed] 📱 Removed homepage horizontal body overflow on mobile around the animated example carousel.
- [x] [Fixed] 🖼️ Restored the original desktop carousel breakout/fade behavior while keeping the mobile overflow fix.
- [x] [Fixed] 🖐️ Disabled text selection on homepage example cards (including iOS touch callout) for smoother swipe and tap behavior.
- [x] [Improved] 🔗 Added a clearer “Discover more inspirations” link below the homepage carousel.
- [x] [Fixed] ⚡ Example trips now open faster with less perceived delay.
- [x] [Improved] 🗓️ Added minimal bottom calendar lanes on every example card that mirror city stay colors and relative stay/route sizing.
- [x] [Improved] 🏷️ Added city-lane hover tooltips on example cards with subtle offset outlines derived from each lane color.
- [x] [Fixed] 🎯 Increased city-lane hover hit area, switched tooltips to city names only, and stabilized lane hover styling to avoid visible card jitter.
- [x] [Fixed] 🧭 Refined city-lane hover visuals with a tighter, thicker border effect and kept pointer cursor behavior.
- [x] [Fixed] 🪟 Added extra carousel vertical buffer so example card hover shadows are no longer clipped at the wrapper edge.
- [x] [Improved] 🧬 Improved visual continuity when opening example cards into full trip views.
- [x] [Fixed] 🎞️ Adjusted transition behavior to prioritize speed and reliability when opening examples.
- [x] [Fixed] ⚙️ Reduced back-navigation lag from trip pages by removing heavy transition wrapping.
- [x] [Fixed] 🔤 Restored system sans-serif body text and stabilized local Space Grotesk subset loading to avoid visual jumps on resize.
- [x] [Improved] 🪶 Headline line breaks are now cleaner and more readable across pages.
- [x] [Improved] 🌏 Added a new multi-country “Backpacking South East Asia” example card with an openable 37-day roundtrip route template, richer city/activity coverage, localized card titles/city labels across all supported languages, and template defaults tuned for vertical timeline + minimal map.
- [ ] [Internal] 🧩 Added shared transition-name helpers and example-template mini-calendar data utilities to keep card and trip visual mapping consistent.
- [ ] [Internal] 🧪 Added View Transition diagnostics to the on-page debugger, including lifecycle events and live anchor audits.
- [ ] [Internal] 🧱 Optimized debugger transition-anchor scanning and added duplicate-name detection to reduce debug overhead on large trip pages.
- [ ] [Internal] 📐 Extended brand guidelines with a documented section-link style and tracking rule to keep content-link UI patterns consistent.
- [ ] [Internal] 📚 Documented navigation prewarm and transition guardrails in the performance backlog to prevent blocking route transitions during future speed work.
