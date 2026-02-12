---
id: rel-2026-02-12-homepage-example-carousel-mobile-and-transition-lanes
version: v0.53.0
title: "Homepage example carousel mobile fix and transition lanes"
date: 2026-02-12
published_at: 2026-02-12T05:41:01Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Stabilized the homepage example carousel on mobile and upgraded example cards with timeline lane visuals plus smoother card-to-trip transitions."
---

## Changes
- [x] [Fixed] 📱 Removed homepage horizontal body overflow on mobile around the animated example carousel.
- [x] [Fixed] 🖼️ Restored the original desktop carousel breakout/fade behavior while keeping the mobile overflow fix.
- [x] [Improved] 🔗 Added a harmonized “Discover more inspirations” section link below the homepage carousel and tracked clicks via Umami event analytics.
- [x] [Fixed] ⚡ Reduced delay when opening example trips by prewarming the trip view in the background instead of blocking navigation on click.
- [x] [Improved] 🗓️ Added minimal bottom calendar lanes on every example card that mirror city stay colors and relative stay/route sizing.
- [x] [Improved] 🏷️ Added city-lane hover tooltips on example cards with subtle offset outlines derived from each lane color.
- [x] [Fixed] 🎯 Increased city-lane hover hit area, switched tooltips to city names only, and stabilized lane hover styling to avoid visible card jitter.
- [x] [Fixed] 🧭 Refined city-lane hover visuals with a tighter, thicker border effect and kept pointer cursor behavior.
- [x] [Fixed] 🪟 Added extra carousel vertical buffer so example card hover shadows are no longer clipped at the wrapper edge.
- [x] [Improved] 🧬 Linked example card map/title/city-lane visuals to matching trip-page elements via shared View Transition names for smoother morph animations.
- [x] [Fixed] 🎞️ Temporarily disabled homepage-to-example View Transition triggering to restore fast, direct navigation while transition reliability is investigated.
- [x] [Fixed] ⚙️ Removed global click-based View Transition wrapping for route changes to avoid slow back navigation from trip pages.
- [x] [Fixed] 🔤 Restored system sans-serif body text and stabilized local Space Grotesk subset loading to avoid visual jumps on resize.
- [x] [Improved] 🪶 Applied global headline `text-wrap: pretty` for cleaner line breaks across pages.
- [ ] [Internal] 🧩 Added shared transition-name helpers and example-template mini-calendar data utilities to keep card and trip visual mapping consistent.
- [ ] [Internal] 🧪 Added View Transition diagnostics to the on-page debugger, including lifecycle events and live anchor audits.
- [ ] [Internal] 🧱 Optimized debugger transition-anchor scanning and added duplicate-name detection to reduce debug overhead on large trip pages.
- [ ] [Internal] 📐 Extended brand guidelines with a documented section-link style and tracking rule to keep content-link UI patterns consistent.
- [ ] [Internal] 📚 Documented navigation prewarm and transition guardrails in the performance backlog to prevent blocking route transitions during future speed work.
