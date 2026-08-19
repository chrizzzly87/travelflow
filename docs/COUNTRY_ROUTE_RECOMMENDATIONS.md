# Country Route Recommendations

Up to **three featured routes per country**, rendered on the country guide page in the same visual language as the homepage example trip cards, and one click away from a fully prefilled multi-city create-trip form.

This document is the contract. Content work (adding routes for the remaining countries) builds on it without further architecture decisions.

---

## 1. Why this exists

Country guide pages (`/inspirations/country/:slug`) answer *when to go* and *what is there*. They do not answer **"what would my trip actually look like?"**. A featured route closes that gap with a concrete, bookable-feeling shape: a title, a duration, an ordered list of stops with night counts, and a one-click handoff into the planner.

The homepage already has the right visual metaphor — the example trip card, with its map header, duration/city counters, tag pills and proportional city lane strip. Reusing that component verbatim means the recommendation reads as *"a trip someone already planned"*, not as a marketing tile.

---

## 2. Data model

### 2.1 Types — `shared/countryRoutes.ts`

```ts
type CountryRoutePace  = 'relaxed' | 'balanced' | 'fast';
type CountryRouteStyle =
  | 'classic' | 'off-the-beaten-path' | 'road-trip' | 'island-hopping'
  | 'beach-and-culture' | 'nature-and-hiking' | 'food-and-wine' | 'city-break';

interface CountryRouteStop {
  name: string;                  // canonical English display name ("Kyoto")
  nights: number;                // >= 0.5, half nights allowed
  subdivisionCode?: string;      // ISO 3166-2, must be prefixed with the route countryCode
  coordinates?: { lat: number; lng: number };
  note?: string;                 // internal curator note, never rendered
}

interface CountryRouteLocalization {
  title?: string;
  pitch?: string;
  tags?: string[];               // must match tags.length when present
  stops?: string[];              // must match stops.length when present
}

interface CountryRoute {
  id: string;                    // globally unique, kebab-case, prefixed with countrySlug
  countryCode: string;           // ISO 3166-1 alpha-2, uppercase
  countrySlug: string;           // destination guide slug ("japan")
  featuredRank: 1 | 2 | 3;       // display order, unique within a country
  title: string;                 // English source copy
  pitch: string;                 // English source copy, one sentence
  style: CountryRouteStyle;
  pace: CountryRoutePace;
  durationDays: number;          // === totalNights + 1 (enforced)
  isRoundTrip: boolean;          // true iff first stop name === last stop name
  stops: CountryRouteStop[];     // ordered, >= 2
  tags: string[];                // 2-4, from the shared tag vocabulary
  bestMonths: number[];          // 1-12, unique, non-empty
  mapColor: string;              // tailwind class, card header wash   ("bg-rose-100")
  mapAccent: string;             // tailwind class, card header markers ("bg-rose-400")
  avatarColor: string;           // tailwind class, curator badge       ("bg-rose-600")
  curator: string;               // handle shown where a user avatar would be
  templateId?: string;           // future premade trip template id
  localized?: Partial<Record<AppLanguage, CountryRouteLocalization>>;
}

interface CountryRouteDocument {
  schemaVersion: 1;
  updatedAt: string;             // ISO timestamp
  routes: CountryRoute[];
}
```

### 2.2 Field notes and rationale

| Field | Decision |
|---|---|
| `id` | Stable and human-readable (`japan-golden-route`). Used as analytics payload, React key, and the future premade-template join key. Never renumber. |
| `countrySlug` | Denormalized next to `countryCode` on purpose: the validator cross-checks the pair against `destinationGuides.json`, so a wrong slug fails the build instead of silently rendering nothing. |
| `featuredRank` | Explicit rather than array order, so the JSON can be sorted/regenerated without changing what users see. Capped at 3 — the "3 featured routes" promise is enforced, not conventional. |
| `nights` on stops | The night count is the source of truth. `durationDays` is derived and validated (`nights + 1`), which makes an editing mistake impossible to ship. |
| `coordinates` | Optional but strongly encouraged: it is the escape hatch for stops that are real places but absent from the destination catalogue (Sintra, Vík, Shirakawa-go), and it is the future input for per-route static maps. |
| `subdivisionCode` | ISO 3166-2 where a stop maps to a known subdivision/island. Lets a route later resolve to a `DestinationOption` island entry. |
| `isRoundTrip` | Drives the `Repeat` badge on the card. Enforced to agree with the stop list so the badge cannot lie. |
| `mapColor` / `mapAccent` / `avatarColor` | Tailwind class strings, exactly as `ExampleTripCard` already consumes them. Storing classes (not hex) keeps the two card sources interchangeable. |
| `curator` | See §5. |
| `templateId` | Reserved. Empty today; when premade templates land, this points at `data/exampleTripTemplates/*`. |

---

## 3. Where the data lives

**Decision: a standalone curated `data/countryRoutes.json`, typed and validated by `shared/countryRoutes.ts`.**

Alternatives considered:

| Option | Verdict |
|---|---|
| Extend `data/destinationGuides.json` | **Rejected.** That file is *generated* by `scripts/import-destination-guides.ts`. Hand-curated routes placed inside it would be clobbered on the next import run, and its validator is coupled to importer-owned invariants. |
| TypeScript module (`data/countryRoutes.ts`) | **Rejected.** Routes are content, not code. JSON keeps them diffable, machine-writable by an import/admin tool later, and validatable by a standalone script without a TS build step in the loop. |
| Per-country files (`data/countryRoutes/japan.json`) | **Rejected for now.** At ~50 countries × 3 routes the single file stays reviewable. Revisit past ~100 routes; the document wrapper (`schemaVersion` + `routes[]`) makes a later split mechanical. |

The file is curated by hand (or by an agent), never generated. `shared/countryRoutes.ts` owns the types *and* the validation function, matching the `shared/destinationGuides.ts` + `scripts/validate-destination-guides.ts` split already used in this repo.

---

## 4. Validation — `scripts/validate-country-routes.ts`

Wired into `build` and `build:netlify` next to the other validators. It calls `validateCountryRouteDocument(document, resolvers)`; the pure validator lives in `shared/` and the script injects repo-specific resolvers so the shared module stays dependency-free and unit-testable.

Enforced rules:

1. `schemaVersion === 1`, `updatedAt` parses as a date.
2. Route ids are globally unique and kebab-case, and start with `countrySlug`.
3. `countryCode` is uppercase ISO 3166-1 alpha-2 and resolves to a real country guide; `countrySlug` matches that guide's slug.
4. **At most 3 routes per country**, `featuredRank` in 1..3 and unique within the country.
5. `stops.length >= 2`; every stop has a non-empty name and `nights >= 0.5`.
6. **Every stop resolves to a real place**: it matches a destination guide entry (country, city or island) or a `DESTINATION_OPTIONS` name/alias — *or* it carries explicit `coordinates`. Coordinates are the deliberate escape hatch: the destination catalogue is airport-derived and does not contain every legitimate stop, so requiring catalogue membership would make good routes unshippable. Coordinates are range-checked (`lat` ±90, `lng` ±180).
7. `subdivisionCode`, when present, matches `^[A-Z]{2}-[A-Za-z0-9]{1,3}$` and its country prefix equals `countryCode`.
8. `bestMonths` is non-empty, integers 1..12, no duplicates.
9. `durationDays === round(sum(stop.nights)) + 1`.
10. `isRoundTrip` is true **iff** the first and last stop names are equal.
11. `tags` has 2..4 entries, all from `COUNTRY_ROUTE_TAGS` (a subset of the example-card tag vocabulary, so tags translate for free).
12. `mapColor` / `mapAccent` / `avatarColor` match `^bg-[a-z]+-\d{2,3}$`.
13. `localized` keys are valid `AppLanguage` values; localized `tags` / `stops` arrays, when present, have the same length as their English counterparts.

A unit test asserts that every entry of `COUNTRY_ROUTE_TAGS` has a translation in the example-card tag map, so a new tag cannot silently render untranslated.

---

## 5. Rendering contract

`CountryRouteCards` does **not** reimplement the card. It adapts a `CountryRoute` into the exact props `components/marketing/ExampleTripCard.tsx` already accepts, and renders that component. No changes to the homepage card were required beyond exporting the tag vocabulary, so the homepage is untouched.

| Example card prop | Source on `CountryRoute` |
|---|---|
| `card.id` | `route.id` |
| `card.title` | `route.title` (English base) |
| `card.countries` | Single entry: guide country name + ISO code for `FlagIcon` |
| `card.durationDays` | `route.durationDays` |
| `card.cityCount` | Count of **distinct** stop names (a round-trip's repeated start/end counts once) |
| `card.mapColor` / `mapAccent` / `avatarColor` | Same-named fields |
| `card.tags` | `route.tags` — translated by the card's existing tag map |
| `card.isRoundTrip` | `route.isRoundTrip` |
| `card.username` | `route.curator` |
| `card.localized` | `route.localized` title/tags/stops, mapped into the card's localization shape |
| `miniCalendar.cityLanes` | One lane per stop: `{ id, title: stop.name, nights: stop.nights, color }` |
| `miniCalendar.routeLanes` | Synthetic 0.2-day connector between consecutive stops, coloured from the preceding stop |

Lane colours come from the shared city palette (`getRandomCityColor` → `getHexFromColorClass`), with **repeated stop names reusing the same colour** — the same rule `normalizeCityColors` applies to real trips, so a round trip visually closes.

**Map image.** `mapImagePath` points at a committed PNG under `public/images/trip-maps/routes/<id>.png`, rendered by `pnpm maps:routes:generate` (see §5.1). The card consumes it exactly like a homepage example card. When a route has no generated map the field stays unset and `ExampleTripCard` falls back to its decorative dotted-route header tinted by `mapColor`/`mapAccent` — a first-class state of the component, not a degradation. The same fallback covers a missing file at runtime, via the card's image `onError` handler.

### 5.1 Static map previews

`scripts/generate-country-route-maps.ts` (`pnpm maps:routes:generate`) renders one Static Maps PNG per route and writes `mapImagePath` back into `data/countryRoutes.json`.

- **Shared treatment.** The URL builder lives in `scripts/lib/staticMapPreview.ts` and is shared with `scripts/generate-trip-maps.ts`, so route cards and homepage cards get identical dimensions (680×288 @2x), style tokens, path weights and S/E markers. Country routes always use the `clean` basemap so the three cards of a country read as a set.
- **Route mode.** `realistic` (Directions polylines) for everything except `island-hopping`, which has no drivable geometry and falls back to straight legs anyway.
- **Colours.** Marker colours come from `buildCountryRouteMiniCalendar`, so the pins match the coloured city lanes underneath the map.
- **Unresolved stops.** A route whose stops do not all carry `coordinates` is skipped with a warning and keeps the decorative header. The generator never draws a partial line.
- **Committed output.** PNGs are committed; the build must not call the Maps API. `pnpm routes:validate` fails if a declared `mapImagePath` has no committed file, and `--dry-run` prints the URLs without spending quota.

**Curator identity. Curated routes have no user behind them. Rendering a fake username would be dishonest. The card slot that normally shows an avatar + handle shows the brand curator handle (`travelflow`) with the route's `avatarColor`, and `showCreatorAttribution` is left `false`, so it renders as plain text rather than a link to a non-existent profile.

**Direction safety.** The section adds no new physical-direction CSS: it uses the existing grid utilities and the card component, whose only directional affordances (`rtl:rotate-180` on arrows) are already handled. The section CTA arrow reuses the same `rtl:rotate-180` pattern used elsewhere in `DestinationGuideView`.

**Placement.** Directly under the "Explore cities and islands" section on country guides, above the highlights/airports grid — after the user knows *where* things are, before generic highlights. Only rendered for `kind === 'country'` guides and only when at least one route exists.

---

## 6. Prefill contract

Clicking a route card navigates to `/create-trip?prefill=<base64url>` built by `buildCreateTripUrl`.

```ts
buildCreateTripUrl({
  countries: ['Japan'],                                   // resolved destination names
  cities: 'Tokyo, Hakone, Kyoto, Osaka',                  // legacy comma-joined string
  cityList: ['Tokyo', 'Hakone', 'Kyoto', 'Osaka'],        // NEW: ordered, structured
  roundTrip: false,
  pace: 'Balanced',
  meta: {
    source: 'country_route',
    label: 'Golden Route Classic',
    routeId: 'japan-golden-route',
  },
});
```

### 6.1 Why `cityList` was added

`TripPrefillData.cities` is a single comma-separated string. It round-trips order correctly today (verified end-to-end and covered by tests), but it is lossy in ways that matter for a route: a stop name containing a comma is unrecoverable, and no consumer can tell "an ordered itinerary" from "a bag of city hints".

`cityList?: string[]` is added as an **optional, additive** field:

- **Encoding** — writers may set `cityList`, `cities`, or both. `buildCreateTripUrl` is unchanged.
- **Decoding** — `decodeTripPrefill` accepts both. If `cityList` is present it is trimmed, emptied entries dropped, order preserved, and capped at `MAX_PREFILL_CITY_LIST` (24) entries. If `cities` is absent it is derived as `cityList.join(', ')`. If only `cities` is present, behaviour is byte-identical to today and no `cityList` is synthesised.
- **Backward compatibility** — every link already in the wild carries only `cities`, decodes exactly as before, and continues to fill `specificCities`. Old builds receiving a new link simply ignore the unknown `cityList` key and use the `cities` mirror. The change is forward- and backward-compatible in both directions, which is why both fields are always written.

`specificCities` in the create-trip form remains the string; `cityList` is what future structured consumers (route lock, map preview, premade templates) will read.

---

## 7. Localization strategy

**Decision: inline `localized` maps on each route, not locale namespace keys.**

Reasons:

1. The homepage example cards already do exactly this (`ExampleTripCard.localized`), and the route card *is* that card. Two mechanisms for the same rendered strings would be a trap.
2. Route titles and pitches are **content**, versioned with the route. A route added in one PR should carry its translations in that PR's diff, not scatter into 11 locale files that `i18n:validate` then demands parity on for a route that may be removed next week.
3. `i18n:validate` enforces *parity* across locale files. Content that legitimately ships English-first would either block the build or force placeholder translations. The inline map has an explicit, documented fallback instead.

**Fallback chain:** `localized[locale]` → `localized.en` → English base fields. Resolution mirrors `getLocalizedExampleTripCard`.

**Section chrome is different.** Headings, eyebrow, subtitle, CTA label and the "best months" label are *UI*, not content, so they live in `locales/*/pages.json` under `inspirations.subpages.guide.routes.*` and are shipped in **all 11 locales** with ICU `{placeholders}`.

**Current content coverage:** English base plus `de`, `es`, `fr`, `it`, `pt` for `title` and `pitch`. `ru`, `pl`, `ko`, `fa`, `ur` fall back to English until translated — tracked in §9. Stop names are not localized: they are place names, rendered the same way `DestinationGuideView` already renders `guide.name`.

---

## 8. Content workflow — adding a route

1. Pick a country that has a guide (`data/destinationGuides.json`, `kind: "country"`). Note its `countryCode` and `slug`.
2. Check `data/countryRoutes.json` — if the country already has 3 routes, you must replace one, not add a fourth.
3. Append a route object to `routes[]`:
   - `id`: `<countrySlug>-<short-kebab-name>`, never reused.
   - `featuredRank`: the free slot (1, 2 or 3) for that country.
   - `stops`: ordered, with `nights` per stop and `coordinates` for anything not obviously in the destination catalogue. Repeat the first stop as the last one for a round trip.
   - `durationDays`: sum of nights + 1. The validator will tell you if you got it wrong.
   - `tags`: 2–4 from `COUNTRY_ROUTE_TAGS`.
   - `bestMonths`: months the route actually works, not the country's generic high season.
   - Colours: keep one palette family per country so the three cards read as a set.
4. Add `localized` entries for at least `de` (EN/DE are the sign-off languages).
5. Bump `updatedAt`.
6. Run `pnpm maps:routes:generate --dry-run` to inspect the map URL, then `pnpm maps:routes:generate --route=<id>` to render and commit the PNG.
7. Run `pnpm routes:validate`, then `pnpm test:core`.
8. User-facing copy → EN/DE style approval per `CLAUDE.md` before merge.
9. Add a release-note line in `content/updates/*.md`.

Nothing else needs touching: the service, the card, the analytics and the prefill all read from the document generically.

---

## 9. Open questions / future work

- **Premade trip templates.** `templateId` is reserved but unused. The intended shape is one `data/exampleTripTemplates/<id>.ts` per featured route, so "Plan this route" can hand over a fully built itinerary (activities, travel legs, mini calendar from real data) instead of a prefilled form. That changes the CTA target, not the schema.
- **Per-route static maps.** Shipped — see §5.1. Remaining: regenerate when a route's stops change (the generator keeps existing PNGs unless `--force` is passed).
- **Translation backlog.** `ru`, `pl`, `ko`, `fa`, `ur` route titles/pitches.
- **Content coverage.** 5 countries × 3 routes ship with this system. ~45 guide countries remain.
- **AI-generated variants.** A route is a good seed for "make this trip mine" — same stops, user's dates, pace and traveller type. Needs the premade templates first.
- **Ranking / experimentation.** `featuredRank` is currently editorial. If routes get click data via `inspirations__country_route`, ranking could become data-driven.
- **Multi-country routes.** The schema is deliberately single-country (the feature is "3 routes per country"). A cross-border route would need `countryCodes[]` and a different placement surface.
