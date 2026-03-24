---
id: rel-2026-03-23-features-airport-bento-splitflap
version: v0.0.0
title: "Features page now teases nearby departures with a split-flap airport card"
date: 2026-03-23
published_at: 2026-03-23T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Makes the airport bento the lead Features card with a cleaner dual split-flap route that starts on DXB, warms the nearest nearby passenger airport just before view, and then flips on screen."
---

## Changes
- [x] [Improved] 🛫 The Features page now leads with a nearby-departure bento card that starts on DXB, warms the closest passenger airport nearby just before you reach it, and then flips on screen.
- [x] [Improved] ✨ The airport teaser now uses a cleaner two-board route animation with stronger consumer-facing copy, so the nearby departure feels more personal without feeling invasive.
- [x] [Improved] ↔️ The airport teaser now spans the full row with a more horizontal route layout, so the departure and destination boards feel like one clean travel moment instead of a stacked card.
- [x] [Improved] 🌍 The hero globe now runs larger on phones and desktop, while the split-flap airport card scales down more gracefully on small screens.
- [ ] [Internal] 🎨 Simplified the airport teaser styling to use lighter split-flap boards, a lighter card surface, and less chrome around the route moment.
- [ ] [Internal] 🧭 Reworked the activation logic so the destination board can run early, the nearest-airport lookup can warm just ahead of view, and the departure board flips only once the row is visible enough to land cleanly.
- [ ] [Internal] 🛠️ Restored the original split-flap animation behavior from the playground component so the Features teaser uses the real sequential board flip instead of a remounted text swap.
- [ ] [Internal] ⚡ Kept the airport teaser lightweight by warming the nearby-airport lookup shortly before the card is reached instead of running it on initial page load.
- [ ] [Internal] 🧪 Added browser regression coverage so the nearby-airport lookup can prewarm early without replacing the departure board before the card is actually in view.
