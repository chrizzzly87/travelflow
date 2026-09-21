---
id: rel-2026-09-21-features-page-redesign
version: v0.189.0
title: "A quieter features page"
date: 2026-09-21
published_at: 2026-09-21T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The features page is shorter, calmer and says what TravelFlow actually does, with the mock screenshots replaced by real trip maps."
---

## Changes
- [x] [Improved] ✂️ The features page is about half as long. Six overlapping cards and a section that repeated them are now three clear ones, so you can read the whole page without scrolling past the same promise three times.
- [x] [Improved] ✍️ Every line of copy was rewritten, in all eleven languages. Short and plain instead of vague: what you say, what comes back, and what you can hand to the people coming with you.
- [x] [Improved] 🗺️ The made-up screenshots are gone. The cards now show real trip maps, so what you see on the page is what the app actually draws.
- [x] [Improved] 🌬️ The headline now settles in word by word, and cards light up softly as your pointer crosses them.
- [x] [Fixed] 🔤 In Arabic, Persian and Urdu, the airport board read its codes backwards — DXB showed as BXD, and the route pointed from the destination back to you.
- [ ] [Internal] 🧱 Replaced the bento grid with a capability grid and a standalone airport band; deleted roughly 440 lines of hand-built fake product UI carrying untranslated English strings.
- [ ] [Internal] 🎞️ Added two CSS-only primitives in place of the React Bits originals (word reveal, pointer spotlight). No GSAP, Framer Motion or three.js, which do not work under preact/compat.
- [ ] [Internal] ⏱️ Card entry stagger now shifts `animation-range`; the previous `animationDelay` was inert on a `view()` timeline and animated nothing.
