---
id: rel-2026-09-16-taiwan-recommendations-deck
version: v0.173.0
title: "Swipe through ideas for your trip"
date: 2026-09-17
published_at: 2026-09-17T07:35:19Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Keep or skip place ideas one card at a time — each with a photo, a map, a proper write-up and the dishes worth ordering — park the ones you like, and drop them onto a day when you know where they fit."
---

## Changes
- [x] [New feature] 🃏 Open **Ideas** on a trip and go through places one card at a time — swipe right to keep, left to skip, and undo if you were too quick.
- [x] [New feature] 🇹🇼 Taiwan comes with 84 places to start from, each with its city, what it costs and how long to allow.
- [x] [New feature] 🍜 Every one has a proper write-up and a short **Recommendations** list — the dishes to order, when to go, what to skip.
- [x] [New feature] 📸 Each card carries a photograph of the place and a map of the neighbourhood it sits in, with the photographer credited.
- [x] [New feature] 📥 Keep the ones you like in their own list until you know where they fit, then drop one onto a day — the days are grouped by the city you are in, so you are choosing a spot in Taipei rather than a date in a list of twenty.
- [x] [New feature] 🧭 Tap the address at the foot of a card to open the place in your own map app; Android offers its usual chooser, iPhone asks between Apple Maps and Google Maps.
- [x] [New feature] 🗂️ A **Skipped** tab keeps everything you passed on, so a card you swiped away too fast goes straight back into the deck.
- [x] [New feature] 💾 Your keeps and skips are remembered, so closing the tab or reloading does not wipe the pile you just went through — including on a shared link you cannot edit.
- [x] [New feature] 🗃️ Ideas are maintained in the admin now: add a place, write it up, publish it, and it is in the deck without waiting for a release.
- [x] [Improved] 🂠 The deck reads and moves like a deck — cards stacked and staggered behind the one you are holding, each fully drawn, gliding forward as you swipe the front one away.
- [x] [Improved] 🔢 It tells you how many ideas are still ahead, so you know whether you are three cards in or thirty.
- [x] [Improved] 🙏 Every idea credits the person who recommended it, with a link to their post.
- [x] [Improved] ⌨️ The deck answers the arrow keys as well as a swipe, so it works on a laptop too.
- [ ] [Internal] 🗺️ Added a KML importer for Google My Maps: no pin in an export carries coordinates, so it geocodes each one and records the precision. All 84 Taiwan pins resolved — 44 rooftop, 37 approximate, 3 exact.
- [ ] [Internal] 🔗 A pin can cite several creators with the handles and URLs in different orders, so sources are paired by matching the handle inside the URL path rather than by position. 24 of the 84 pins cite more than one.
- [ ] [Internal] 🏷️ The source category alone mis-types a pin — one filed under sights reads "Free 20-min hike" — so the note is read for types, cost band, duration and time of day, and everything imported lands `in_review`.
- [ ] [Internal] 🗄️ The library moved into Supabase: `public.recommendations` with a published-only read policy, an admin edge function that proves the caller's role with their own token and then writes on the service role, and `/admin/recommendations` on top. **The migration is not applied by a deploy** — apply `supabase/migrations/20260917090000_recommendations_library.sql` by hand, then seed. Verified against a throwaway Postgres: defaults, every check constraint, country/slug uniqueness, the updated_at trigger, and that anon sees the published row and not the draft.
- [ ] [Internal] 📦 The repo dataset is now a seed and an offline fallback rather than the source of truth. The client asks the API first and drops to the file only when it cannot answer; an empty published list is a real answer, because falling back there would show ideas an editor deliberately unpublished.
- [ ] [Internal] 🌱 Seeding works both ways: **Import bundled** in the admin, or `scripts/sync-recommendations-to-supabase.ts`, which previews what it would overwrite before `--apply`.
- [ ] [Internal] 🖼️ The photo-reference guard rejected a real photo: its length bound came from a sample, and the longest id in the Taiwan library is 586 characters. The character class is what closes the open redirect; the length was only a sanity bound, and is now set well clear.
- [ ] [Internal] 🧳 The kept pool lives on the trip document, so it needs no migration and a dismissal follows the traveller across devices.
- [ ] [Internal] 🖼️ Photos come from Google Places by reference, never rehosted: the dataset stores the photo resource name and the photographer's attribution, and a new `/api/place-photo` edge function resolves it so the key stays server-side. All 84 Taiwan places have one.
- [ ] [Internal] 🗺️ The card map reuses the existing trip map preview endpoint with a single coordinate, so it needs no new provider integration.
- [ ] [Internal] 🚪 The ideas view is a full surface rather than a bottom drawer — it already opens from the planner's own sheet, and a sheet inside a sheet reads as redundant. Radix Dialog still supplies focus trap, Escape, scroll lock and restored focus.
- [ ] [Internal] 🔗 Its open state moved from the URL into React: `useTripViewSettingsSync` rewrites the query with `history.replaceState`, which React Router never sees, so the router's `location.search` went stale and the next write dropped the parameter — which is why reopening came up empty. The deep link is still read once on mount.
- [ ] [Internal] 🎬 `AnimatePresence` was nested inside the card loop and keyed per card, so it unmounted together with its own child and the exit never ran. One presence now wraps the top card, with the direction passed through `custom` because the decision and the new list land in the same render.
- [ ] [Internal] 🎞️ The deck is built on framer-motion, already a dependency: drag with `useMotionValue`, rotation and the Keep/Skip stamps via `useTransform`, and an exit animation through `AnimatePresence`. A release commits on distance *or* flick velocity — without the velocity test a fast short flick springs back and the deck feels dead. shadcn has no swipe or card-stack component; this is the common motion pattern.
- [ ] [Internal] 💾 Decisions are written to two homes at once: the trip document, and a per-trip device store behind `tf_trip_recommendations_v1`. A shared `?v=` link and an example trip are read-only, so the trip write is a no-op there and everything was lost on reload. The two are merged on open, and a merge never un-makes a decision.
- [ ] [Internal] 🗺️ The map preview endpoint takes a `zoom` for a single coordinate: `auto` framing a lone pin produces the tightest camera the provider can draw. Added to the CDN cache allowlist so the two zooms do not share a cache entry.
- [ ] [Internal] 🖼️ Photo choice is now a scored pick over Google's photo list rather than the first entry: the provider's own ordering dominates, portraits are passed over because a wide hero crops them to nothing, and a photo attributed to the venue itself outranks the rest. Fourteen places had no picture at all because their stored id came from the geocoder rather than Places; those are re-resolved by name.
- [ ] [Internal] ✍️ The written copy lives in `data/recommendations/tw.content.json`, keyed by slug, and is merged in by `scripts/apply-recommendation-content.ts`. Keeping it out of the generated dataset means re-running the import or the photo pass never overwrites anything a human wrote.
- [ ] [Internal] 🧩 Card media, body and the sticky location footer moved into one shared component, so the deck's front card, the cards behind it and the detail modal cannot drift apart.
- [ ] [Internal] 🎬 `mode="popLayout"` was dropped from the deck: it wraps each child in a component that hands it a ref, and preact/compat drops refs on function components. The cards are absolutely positioned, so there is no layout to pop out of.
- [ ] [Internal] 👆 The planner sheet captures the pointer on its drag handle, which retargets the following `pointerup` and swallowed the click on every control in the header — the Ideas button included. Verified with a real click rather than a scripted `.click()`, which bypasses pointer capture entirely.
- [ ] [Internal] 🔁 Reopening the ideas view came up empty: its open state lived in the URL, and `useTripViewSettingsSync` rewrites the query with `history.replaceState`, which React Router never sees — so `location.search` went stale and the next write dropped the parameter. Now React state, with the deep link read once on mount.
- [ ] [Internal] 👀 Every card in the stack renders its real content, not just the top one, so text no longer appears for the first time mid-swipe. The address moved into a pinned footer and the creator credit onto the full card, so a long write-up cannot push "where is this" out of sight.
- [ ] [Internal] 🧪 Coverage for source pairing, note enrichment, deck ordering and exclusion, the library-row-to-timeline-item copy, the deck's swipe, keyboard and undo behaviour, the device store and its merge rules, and the photo-scoring heuristic.
