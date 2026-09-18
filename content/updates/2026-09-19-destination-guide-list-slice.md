---
id: rel-2026-09-19-destination-guide-list-slice
version: v0.178.0
title: "Faster country, festival and map pages"
date: 2026-09-19
published_at: 2026-09-19T10:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The countries explorer, the world map and the festivals list now load a fraction of the data they used to, so they appear sooner — especially on a phone or a slow connection."
---

## Changes
- [x] [Improved] 🌍 Browsing countries, the world map and the festivals list now start up noticeably quicker, because each page downloads only the country details it actually shows instead of every guide in full.
- [ ] [Internal] Added `scripts/split-destination-guides.mjs`, deriving `data/destinationGuideList.generated.json` (20 KB) from the 680 KB `data/destinationGuides.json` monolith, which stays the on-disk source of truth.
- [ ] [Internal] Added `data/destinationGuideList.ts` with `listCountryGuideSummaries` and `getCountryGuideSummary`, whose lookup normalization is kept identical to `destinationGuideService`.
- [ ] [Internal] Re-pointed `countryExplorerService`, `countryRouteService` and `festivalCatalogService` at the slice; `toCountryExplorerEntry` now takes the narrower `DestinationGuideSummary`, which a full `DestinationGuideEntry` still satisfies structurally.
- [ ] [Internal] The detail pages keep reading the whole document through `destinationGuideService`; the Supabase-backed `/api/destinations` route and its edge function are untouched.
- [ ] [Internal] `pnpm destinations:import` now chains `pnpm destinations:split` so the slice cannot fall behind a re-import.
- [ ] [Internal] Added `tests/unit/destinationGuideSplit.test.ts`, which regenerates the slice, fails on drift, and asserts the slice resolves and orders countries exactly as `destinationGuideService` does.
