---
id: rel-2026-09-16-taiwan-recommendations-deck
version: v0.170.0
title: "Swipe through ideas for your trip"
date: 2026-09-16
published_at: 2026-09-16T20:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Keep or skip place ideas one card at a time — each with a photo, a map and who recommended it — park the ones you like, and drop them onto a day when you know where they fit."
---

## Changes
- [x] [New feature] 🃏 Open Ideas on a trip and go through places one card at a time — swipe right to keep, left to skip, with an undo if you were too quick.
- [x] [New feature] 📥 Kept ideas wait in their own list until you know where they fit, then go onto any day of the trip in one tap.
- [x] [New feature] 🇹🇼 Taiwan comes with 84 places to start from, each with its city, what it costs, how long it takes and who recommended it.
- [x] [New feature] 📸 Every card shows a photo of the place and a map of exactly where it is, with the photographer credited.
- [x] [Improved] 🂠 The deck looks and feels like a deck: cards sit stacked behind the one you are reading, and a card follows your finger, tilts, and flies off the way you flicked it.
- [x] [Improved] ⌨️ The card deck answers the arrow keys as well as a swipe, so it works on a laptop too.
- [x] [Improved] 🙏 Every idea credits the person who recommended it, with a link to their post.
- [ ] [Internal] 🗺️ Added a KML importer for Google My Maps: no pin in an export carries coordinates, so it geocodes each one and records the precision. All 84 Taiwan pins resolved — 44 rooftop, 37 approximate, 3 exact.
- [ ] [Internal] 🔗 A pin can cite several creators with the handles and URLs in different orders, so sources are paired by matching the handle inside the URL path rather than by position. 24 of the 84 pins cite more than one.
- [ ] [Internal] 🏷️ The source category alone mis-types a pin — one filed under sights reads "Free 20-min hike" — so the note is read for types, cost band, duration and time of day, and everything imported lands `in_review`.
- [ ] [Internal] 📦 The dataset ships in the repo the way `destinationGuides.json` does, which keeps the deck working without a Supabase round trip; the tables in the plan are still pending.
- [ ] [Internal] 🧳 The kept pool lives on the trip document, so it needs no migration and a dismissal follows the traveller across devices.
- [ ] [Internal] 🖼️ Photos come from Google Places by reference, never rehosted: the dataset stores the photo resource name and the photographer's attribution, and a new `/api/place-photo` edge function resolves it so the key stays server-side. 70 of the 84 Taiwan places have one.
- [ ] [Internal] 🗺️ The card map reuses the existing trip map preview endpoint with a single coordinate, so it needs no new provider integration.
- [ ] [Internal] 🎞️ The deck is built on framer-motion, already a dependency: drag with `useMotionValue`, rotation and the Keep/Skip stamps via `useTransform`, and an exit animation through `AnimatePresence`. A release commits on distance *or* flick velocity — without the velocity test a fast short flick springs back and the deck feels dead. shadcn has no swipe or card-stack component; this is the common motion pattern.
- [ ] [Internal] 🧪 Coverage for source pairing, note enrichment, deck ordering and exclusion, the library-row-to-timeline-item copy, and the deck's swipe, keyboard and undo behaviour.
