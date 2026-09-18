---
id: rel-2026-09-18-mobile-first-load-interactivity
version: v0.175.0
title: "The menu answers your first tap, even while the page is still loading"
date: 2026-09-18
published_at: 2026-09-18T12:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "On a phone, tapping the menu before the page finished loading did nothing at all. That tap is now remembered and the menu opens as soon as it can."
---

## Changes
- [x] [Fixed] 🍔 Tap the menu button on a phone while the page is still loading and it now opens as soon as it is ready. Before, that first tap was simply lost — with no way into navigation or login, you had to guess and tap again.
- [x] [Fixed] 🍪 The cookie notice now appears after your very first tap or scroll, even if that happened while the page was still waking up. It used to wait for a second one you had no reason to make.
- [x] [Improved] 📶 The homepage downloads noticeably less before it responds to you, so the wait on a slow mobile connection is shorter.
- [x] [Improved] 👆 A button you press before the page is ready now visibly acknowledges the press instead of sitting there looking broken.
- [ ] [Internal] 🌉 `index.html` ships an inline pre-hydration bridge that records an interaction and the intent of a press on a `data-tf-boot-intent` control; `services/bootInteractionBridge.ts` is the typed read side. Intent is consumed post-mount, not during the hydration render — opening the drawer on the first render left preact/compat hydrating it against the wrong node, inline and without `role="dialog"`.
- [ ] [Internal] 📦 Example trip cards localize country names from a generated 4 KB table instead of `services/destinationService`, which statically pulled `data/countryTravelData.json`. That took a 424 KB chunk (~372 KB, 25% of the homepage boot JS) off the mobile critical path.
- [ ] [Internal] 🧩 `MobileMenu` is no longer a lazy chunk: it cost a network round trip on the one tap that matters on a phone, and adds ~11 KB to the header chunk instead.
- [ ] [Internal] 🧪 `tests/browser/bootInteractionBridge.browser.test.ts` runs the real inline script from `index.html`; `tests/unit/exampleTripCountryNames.test.ts` asserts the generated table matches `destinationService` for every card country and locale, and fails if it drifts from the source data.
