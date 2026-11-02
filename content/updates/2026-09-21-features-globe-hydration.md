---
id: rel-2026-09-21-features-globe-hydration
version: v0.189.0
title: "The globe on the features page shows up again"
date: 2026-09-21
published_at: 2026-09-21T09:20:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Opening the features page directly now shows the spinning globe with its trip cards in place, instead of an empty circle and a stray Paris card parked under it."
---

## Changes
- [x] [Fixed] 🌍 The globe on the features page now appears when you open that page directly. It was staying invisible, with the Paris card stranded below it and the other trip cards nowhere to be seen — it only looked right if you came in from another page.
- [ ] [Internal] 💧 FeaturesGlobe renders nothing until it is mounted and stays empty through the prerender capture, so the captured HTML matches the client's first pass; preact/compat's hydrate() does not patch attributes on reused DOM, and the capture (headless, no WebGL) had baked in the fallback branch.
- [ ] [Internal] 🧪 Added jsdom coverage proving the capture pass renders an empty container and a real client fills it after mount.
