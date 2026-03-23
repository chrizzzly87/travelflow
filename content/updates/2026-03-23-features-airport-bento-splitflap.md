---
id: rel-2026-03-23-features-airport-bento-splitflap
version: v0.0.0
title: "Features page now teases nearby departures with a split-flap airport card"
date: 2026-03-23
published_at: 2026-03-23T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Makes the airport bento the lead Features card with a cleaner dual split-flap route that starts on DXB, then lazily flips to the nearest nearby passenger airport once the full card is in view."
---

## Changes
- [x] [Improved] 🛫 The Features page now leads with a nearby-departure bento card that starts on DXB, then flips to the closest passenger airport around you once the full card comes into view.
- [x] [Improved] ✨ The airport teaser now uses a cleaner two-board route animation with stronger consumer-facing copy, so the nearby departure feels more personal without feeling invasive.
- [x] [Improved] ↔️ The airport teaser now spans the full row with a more horizontal route layout, so the departure and destination boards feel like one clean travel moment instead of a stacked card.
- [ ] [Internal] 🎨 Simplified the airport teaser styling to use bare split-flap boards, a lighter card surface, and less chrome around the route moment.
- [ ] [Internal] 🧭 Reworked the activation logic so the split-flap boards render immediately while the runtime-location and nearby-airport fetch stay deferred until the row is visible enough to start the transition.
- [ ] [Internal] 🛠️ Restored the original split-flap animation behavior from the playground component so the Features teaser uses the real sequential board flip instead of a remounted text swap.
- [ ] [Internal] ⚡ Deferred the split-flap airport visual and nearby-airport lookup until the card is fully visible, keeping the feature lightweight for first load.
- [ ] [Internal] 🧪 Added browser regression coverage so the airport lookup stays gated behind full in-view activation instead of firing early.
