# Destination & ISO Code System

This document describes how TravelFlow stores, resolves, and uses destination data across the app. It covers the two-tier destination model, ISO code conventions, inspiration data structures, and the trip prefill pipeline.

---

## Architecture Overview

```
COUNTRIES (utils.ts)                    popularIslandDestinations.json
  ~195 entries                            ~414 entries
  { name, code: ISO 3166-1, flag }        { name, countryCode, code?: ISO 3166-2, aliases? }
        │                                        │
        │  .map(→ DestinationOption)             │  buildIslandDestination(seed)
        ▼                                        ▼
   DESTINATION_OPTIONS[]  ◄──── merged array ────┘
        │
        ├── DESTINATION_BY_NAME   (Map: lowercase name → DestinationOption)
        ├── DESTINATION_BY_ALIAS  (Map: lowercase alias → DestinationOption)
        └── DESTINATION_BY_CODE   (Map: lowercase code → DestinationOption)
```

All lookup maps live in `utils.ts` and are built once at module load time.

---

## Data Sources

### 1. `COUNTRIES` array — `utils.ts:782`

Static array of ~195 sovereign countries. Each entry:

```ts
{ name: "Japan", code: "JP", flag: "🇯🇵" }
```

- `code` = **ISO 3166-1 alpha-2** (uppercase, 2 chars)
- Used directly in the destination picker (`CountrySelect`)

### 2. `popularIslandDestinations.json` — `data/popularIslandDestinations.json`

~414 island/sub-national destination entries. Each entry:

```ts
{ "name": "Bali", "countryCode": "ID", "code": "ID-BA", "aliases": [] }
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Display name shown in picker |
| `countryCode` | Yes | ISO 3166-1 code of the parent country |
| `code` | No | Explicit ISO 3166-2 subdivision code. When absent, a slug is generated: `{parentCode}-{slugified-name}` |
| `aliases` | No | Alternative names for search matching (e.g. `["Fraser Island"]` for K'gari) |

### Code generation logic (`utils.ts:1003`)

```
If seed.code exists  →  use it verbatim       (e.g. "ID-BA")
Else                 →  buildIslandCode()      (e.g. "ID-bali")
                        = parentCode + "-" + slugified lowercase name
```

33 islands currently have explicit ISO 3166-2 codes (e.g. Tasmania = `AU-TAS`, Crete = `GR-M`, Bali = `ID-BA`). All others use the slug fallback.

**Important constraint:** `DESTINATION_BY_CODE` is a `Map`. Duplicate codes silently overwrite. Never assign the same ISO 3166-2 code to multiple islands. Some real ISO codes cover multiple islands (e.g. Ecuador's `EC-W` covers all Galapagos islands) — these must NOT be assigned since they'd collide.

### 3. `DestinationOption` interface — `utils.ts:984`

The unified type for all destinations:

```ts
interface DestinationOption {
    name: string;              // "Japan" or "Bali"
    code: string;              // "JP" or "ID-BA"
    flag: string;              // emoji flag
    kind: 'country' | 'island';
    parentCountryName?: string;  // island only: "Indonesia"
    parentCountryCode?: string;  // island only: "ID"
    aliases?: string[];          // island only
}
```

---

## Lookup Functions — `utils.ts`

| Function | Input | Returns | Use case |
|----------|-------|---------|----------|
| `getDestinationOptionByName(name)` | `"Bali"` or `"Fraser Island"` | `DestinationOption \| undefined` | Form validation, name-based search |
| `getDestinationOptionByCode(code)` | `"ID-BA"` or `"JP"` | `DestinationOption \| undefined` | Resolving inspiration data codes |
| `resolveDestinationCodes(codes)` | `["CL", "AR"]` | `["Chile", "Argentina"]` | Converting stored codes to picker-compatible names |
| `searchDestinationOptions(query)` | `"bal"` | `DestinationOption[]` | Typeahead in destination picker |

All lookups are **case-insensitive**.

---

## Inspiration Data — `data/inspirationsData.ts`

Six data collections, all using structured ISO codes for destination resolution.

### Types and their code fields

| Type | Code field(s) | Cardinality | Example |
|------|--------------|-------------|---------|
| `Destination` | `destinationCodes: string[]` | 1+ codes | `["CL", "AR"]` for Patagonia |
| `FestivalEvent` | `destinationCodes: string[]` | 1+ codes | `["NO", "IS"]` for Northern Lights |
| `WeekendGetaway` | `destinationCodes: string[]` | 1+ codes | `["ES"]` for Barcelona |
| `MonthEntry` | `destinationCodes: string[]` | parallel to `destinations[]` | `["TH", "LK", "MX"]` |
| `CountryGroup` | `destinationCode: string` | exactly 1 | `"JP"` |
| `QuickIdea` | `destinationCode: string` | exactly 1 | `"JP"` |

### Optional `cities` field

`Destination`, `FestivalEvent`, and `WeekendGetaway` have an optional `cities?: string[]` for pre-filling specific cities in the trip form. When present, the card UI shows a city count badge (`cities.length`). When absent, no badge is shown.

Cities are free-text display names (not codes). They're passed to the form as a comma-separated string via `TripPrefillData.cities`.

### Display fields vs logic fields

Each type has **display-only** text fields that are NOT used for destination resolution:

| Type | Display field | Purpose |
|------|--------------|---------|
| `Destination` | `country` | Card subtitle (e.g. "Chile & Argentina") |
| `FestivalEvent` | `country` | Card subtitle |
| `WeekendGetaway` | `from`, `to` | Card route label |
| `MonthEntry` | `destinations[]` | Pill labels |
| `QuickIdea` | `dest` | Button label |
| `CountryGroup` | `country` | Section header |

These are purely for rendering. All form prefill logic uses `destinationCodes` / `destinationCode` exclusively.

---

## Trip Prefill Pipeline

```
Inspiration card click
        │
        │  resolveDestinationCodes(card.destinationCodes)
        │  → ["Chile", "Argentina"]   (destination names)
        ▼
   buildCreateTripUrl({
       countries: ["Chile", "Argentina"],
       cities: "Torres del Paine, El Chaltén",
       startDate, endDate, notes, meta
   })
        │
        │  encodeTripPrefill(data) → Base64URL string
        ▼
   /create-trip?prefill=eyJjb3Vud...
        │
        │  decodeTripPrefill(encoded) → TripPrefillData
        │  (validates country names against DESTINATION_OPTIONS)
        ▼
   CreateTripForm pre-fills fields
```

### `TripPrefillData` — `types.ts:139`

```ts
interface TripPrefillData {
    countries?: string[];   // destination names (not codes!)
    startDate?: string;     // ISO date
    endDate?: string;
    budget?: string;
    pace?: string;
    cities?: string;        // comma-separated city names
    notes?: string;
    roundTrip?: boolean;
    mode?: 'classic' | 'wizard';
    styles?: string[];
    vibes?: string[];
    logistics?: string[];
    meta?: { source?: string; author?: string; label?: string; [key: string]: unknown };
}
```

**Key detail:** `countries` contains resolved **names** (e.g. `"Bali"`, not `"ID-BA"`). The `resolveDestinationCodes()` call in `InspirationsPage.tsx` converts codes to names before encoding.

### Encoding — `utils.ts:1166`

`encodeTripPrefill`: JSON → UTF-8 bytes → Base64URL (no padding, `-_` instead of `+/`).

### Decoding — `utils.ts:1174`

`decodeTripPrefill`: Base64URL → JSON → validated `TripPrefillData`. Country names are validated against `DESTINATION_OPTIONS` names — unknown names are silently dropped.

### SEO

The edge function `netlify/edge-functions/site-og-meta.ts` strips the `prefill` query param from the canonical URL to prevent duplicate indexing.

---

## Adding a New Inspiration Entry

1. Choose the correct `destinationCodes`:
   - Country: use ISO 3166-1 alpha-2 (e.g. `"JP"`)
   - Island with explicit code in JSON: use that code (e.g. `"ID-BA"`)
   - Island without explicit code: use `{parentCode}-{slug}` (e.g. `"PH-palawan"`)
   - Multi-country: use array (e.g. `["CL", "AR"]`)

2. Verify codes resolve: `resolveDestinationCodes(["YOUR-CODE"])` must return a non-empty array.

3. Add `cities` only when specific cities add value. Keep the array to real stops a traveler would visit.

4. The `description` field is for card UI — keep it evocative, max ~120 chars (CSS `line-clamp-2`). Don't try to list all cities in the description.

5. Display fields (`country`, `to`, `dest`) are independent of codes — set them to whatever reads well on the card.

## Adding a New Island Destination

1. Add entry to `data/popularIslandDestinations.json` with at minimum `name` and `countryCode`.
2. If the island is an ISO 3166-2 administrative subdivision, add the `code` field (e.g. `"AU-TAS"`).
3. If the island has common alternative names, add `aliases` (e.g. `["Fraser Island"]`).
4. Verify no code collision: search the JSON for any existing entry with the same `code` value.
5. The island will automatically appear in `DESTINATION_OPTIONS` and be available in the picker and for prefill resolution.

---

## File Reference

| File | Role |
|------|------|
| `utils.ts` | `COUNTRIES`, `ISLAND_DESTINATIONS`, `DESTINATION_OPTIONS`, all lookup maps and functions, prefill encode/decode |
| `types.ts` | `TripPrefillData`, `DestinationOption` consumer types |
| `data/popularIslandDestinations.json` | Island seed data with optional ISO 3166-2 codes |
| `data/inspirationsData.ts` | All inspiration content: categories, months, festivals, getaways, country groups, quick ideas |
| `pages/InspirationsPage.tsx` | Renders cards, calls `resolveDestinationCodes()`, builds prefill URLs |
| `components/CreateTripForm.tsx` | Reads `?prefill=` param, pre-fills form fields |
| `components/CountrySelect.tsx` | Destination picker, searches `DESTINATION_OPTIONS` |
| `netlify/edge-functions/site-og-meta.ts` | Strips `prefill` from canonical URLs |
