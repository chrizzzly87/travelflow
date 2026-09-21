---
id: rel-2026-09-21-features-page-redesign
version: v0.190.0
title: "A quieter features page"
date: 2026-09-21
published_at: 2026-09-21T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The features page is shorter, calmer and says what TravelFlow actually does, with the mock screenshots replaced by real routes and a real share card."
---

## Changes
- [x] [Improved] ✂️ The features page is about half as long. Six overlapping cards and a section that repeated them are now three clear ones, so you can read the whole page without scrolling past the same promise three times.
- [x] [Improved] ✍️ Every line of copy was rewritten, in all eleven languages. Short and plain instead of vague: what you say, what comes back, and what you can hand to the people coming with you.
- [x] [Improved] 🗺️ The made-up screenshots are gone. Each card now shows the real thing it describes: the route you get from a first draft, a fuller route after you have moved things around, and the actual preview people see when you send them the link.
- [x] [Improved] 🔗 Sharing, planning and shaping each look different on the page now, instead of three cards showing the same picture.
- [x] [Improved] 🌬️ The headline now settles in word by word, and cards light up softly as your pointer crosses them.
- [x] [Fixed] 🔤 In Arabic, Persian and Urdu, the airport board read its codes backwards — DXB showed as BXD, and the route pointed from the destination back to you.
- [ ] [Internal] 🧱 Replaced the bento grid with a capability grid and a standalone airport band; deleted roughly 440 lines of hand-built fake product UI carrying untranslated English strings.
- [ ] [Internal] 🎞️ Added two CSS-only primitives in place of the React Bits originals (word reveal, pointer spotlight). No GSAP, Framer Motion or three.js, which do not work under preact/compat.
- [ ] [Internal] ⏱️ Card entry stagger now shifts `animation-range`; the previous `animationDelay` was inert on a `view()` timeline and animated nothing.
- [x] [Improved] 📣 The closing invitation is now a real banner rather than another grey box, so it is obvious where to start.
- [x] [Improved] 🧭 Sections are separated by their own background and labelled, so the page reads as chapters instead of one long column.
- [ ] [Internal] 🔎 Rewrote the page title and social preview text for every language; the old ones still described the page as it was two redesigns ago, and Korean had no entry at all.
- [ ] [Internal] 🖼️ Pinned a copy of a generated share card to a stable path. The originals are content-hashed and renamed by `og:site:build`, so referencing one directly would 404 on the next regeneration.
