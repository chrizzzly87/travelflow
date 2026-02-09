---
id: rel-2026-02-09-inspiration-prefill-links
version: v0.25.0
title: "Inspiration links now pre-fill the trip form"
date: 2026-02-09
published_at: 2026-02-09T22:00:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Clicking any destination, festival, or getaway on the Inspirations page now pre-fills the create trip form with country, dates, and notes."
---

## Changes
- [x] [New feature] 🗺️ Inspiration links pre-fill the create trip form with destination, dates, and travel notes.
- [x] [Improved] 🌍 Multi-country trips like Patagonia now correctly select both Chile and Argentina in the form.
- [x] [Improved] 🏝️ Island destinations like Bali & Lombok are selected individually instead of the parent country.
- [x] [Improved] 🏙️ Inspiration cards now pre-fill specific cities (e.g. Tokyo, Kyoto, Osaka for the Cherry Blossom Trail).
- [x] [Improved] 🎪 Festival cards suggest start and end dates based on the next occurrence.
- [x] [Improved] 🏖️ Weekend getaway links default to the coming Saturday with the right duration.
- [x] [Improved] 📅 Monthly destination pills set the start date to the selected month.
- [x] [Improved] 💡 Quick-start ideas now carry country and duration into the form.
- [x] [New feature] 🏷️ A dismissible attribution badge shows which inspiration pre-filled the form.
- [x] [Fixed] 🏴󠁧󠁢󠁳󠁣󠁴󠁿 Edinburgh Highlands getaway now shows the correct Scotland flag.
- [ ] [Internal] Added structured ISO destination codes to all inspiration data entries.
- [ ] [Internal] Island destinations now use ISO 3166-2 codes where available (33 islands), slug fallback otherwise.
- [ ] [Internal] Replaced string-matching destination resolver with code-based lookup.
- [ ] [Internal] Added `TripPrefillData` type and Base64URL encode/decode utilities.
- [ ] [Internal] Edge function strips `prefill` query param from canonical URL for SEO.
- [ ] [Internal] Added `docs/DESTINATION_SYSTEM.md` — comprehensive LLM-optimized reference for the destination and ISO code system.
