# Country Climate Normals & Season Signal

Monthly climate normals (temperature + precipitation) and a curated travel-season signal for
every country in `data/countryTravelData.json`.

This is the data foundation for the "when do you want to go?" month picker on
`/inspirations/countries`: pick a month, and each country card can show expected temperature,
expected rain, and whether that month is high / shoulder / low season.

| Artifact | Role |
|----------|------|
| `data/countryClimateNormals.json` | Committed dataset (source of truth at runtime) |
| `shared/countryClimateNormals.ts` | Types, bounds, season-derivation rule, document validator |
| `services/countryClimateService.ts` | Memoized read API for UI code |
| `scripts/generate-country-climate-normals.ts` | Refresh tool (`pnpm climate:generate`) |
| `scripts/validate-country-climate.ts` | Validator (`pnpm climate:validate`, wired into `build`) |

## Ground rules

- **The JSON is committed.** The build never makes a live network call for climate data. The
  generator is a manual refresh tool, not a build step.
- **Celsius and millimetres only.** Fahrenheit and inches are derived at render time via
  `celsiusToFahrenheit(...)`. Units are never duplicated inside the data file.
- **`season` is a curated editorial signal, not measured tourist volume.** It must never be
  labelled as measured, observed, or actual visitor data in UI copy. See
  [Season derivation](#season-derivation).

## Schema

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-08-18T07:00:00.000Z",

  "units": {
    "temperature": "celsius",
    "precipitation": "millimeters",
    "note": "…Fahrenheit and inches are derived at render time…"
  },

  "source": {
    "provider": "Open-Meteo",
    "endpoint": "https://archive-api.open-meteo.com/v1/archive",
    "dataset": "ERA5 / ERA5-Land reanalysis (Historical Weather API)",
    "window": { "startDate": "2015-01-01", "endDate": "2024-12-31", "years": 10 },
    "accessedAt": "2026-08-18T07:00:00.000Z",
    "license": "CC BY 4.0 (Open-Meteo) — underlying ERA5 data © Copernicus Climate Change Service",
    "attribution": "Weather data by Open-Meteo.com (ERA5 reanalysis, Copernicus Climate Change Service)"
  },

  "seasonDerivation": {
    "signal": "curated",
    "rule": "…see below…",
    "disclaimer": "…NOT measured visitor volume…"
  },

  // Flat list of every sampled coordinate, across all countries.
  "anchors": [
    {
      "id": "TH-BKK",              // `${countryCode}-${iata}` — stable, referenced by countries[]
      "countryCode": "TH",
      "role": "primary",           // "primary" | "secondary"
      "label": "Bangkok (BKK)",
      "latitude": 13.6811,
      "longitude": 100.747,
      "airportIata": "BKK",
      "airportIcao": "VTBS",
      "airportTier": "major",      // "major" | "regional" | "local"
      "derivation": "curated-region" // "curated-region" | "airport-medoid" | "curated-capital"
    }
  ],

  "countries": [
    {
      "countryCode": "TH",
      "countryName": "Thailand",
      "anchor": { "id": "TH-BKK", "label": "Bangkok (BKK)", "latitude": 13.6811, "longitude": 100.747 },
      "anchorCount": 1,
      "months": [
        {
          "month": 1,              // 1 = January … 12 = December
          "avgHighC": 32.4,        // mean daily maximum, °C
          "avgLowC": 22.1,         // mean daily minimum, °C
          "avgTempC": 27.3,        // mean daily mean, °C
          "precipitationMm": 12.7, // mean monthly total, mm
          "rainyDays": 1.9,        // mean days/month with >= 1 mm precipitation
          "season": "high"         // "high" | "shoulder" | "low" — CURATED, not measured
        }
        // … 12 entries, one per month
      ],

      // Present only when anchorCount > 1. regions[0] always mirrors the country-level anchor/months.
      "regions": [
        {
          "key": "bkk",
          "label": "Bangkok",
          "anchor": { "id": "TH-BKK", "label": "Bangkok (BKK)", "latitude": 13.68, "longitude": 100.75 },
          "months": [ /* same shape as above */ ]
        }
      ]
    }
  ]
}
```

Invariants enforced by `pnpm climate:validate`:

- exactly 12 months per country (and per region), one per calendar month, no duplicates
- `avgHighC >= avgLowC`
- all temperatures within `[-70, 60]` °C
- `precipitationMm >= 0` and `<= 4000`; `rainyDays` within `[0, 31]`
- `season` is one of `high` / `shoulder` / `low`
- every `countryCode` resolves to a country in `data/countryTravelData.json`
- every `anchor.id` referenced by a country resolves to an entry in the top-level `anchors` array
- every country with a destination guide (`data/destinationGuides.json`) is covered

## Source and attribution

Climate normals come from the [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api)
(`https://archive-api.open-meteo.com/v1/archive`), which serves ERA5 / ERA5-Land reanalysis data
from the Copernicus Climate Change Service. No API key is required and the non-commercial tier is
free.

- Open-Meteo data is published under **CC BY 4.0**.
- ERA5 is provided by the **Copernicus Climate Change Service (C3S) / ECMWF** under the
  Copernicus licence.
- **Wherever these numbers are shown to users, render the attribution** exposed by
  `getClimateSourceMeta().attribution` (currently: *"Weather data by Open-Meteo.com (ERA5
  reanalysis, Copernicus Climate Change Service)"*), linked to <https://open-meteo.com/>.

Window: daily `temperature_2m_max`, `temperature_2m_min`, and `precipitation_sum` over
**2015-01-01 – 2024-12-31** (10 full years), requested in UTC and aggregated locally:

- `avgHighC` / `avgLowC` / `avgTempC` — mean over every day of that calendar month in the window
- `precipitationMm` — sum per (year, month), then averaged across the 10 years
- `rainyDays` — days with `precipitation_sum >= 1 mm` per (year, month), averaged across the years

Values are rounded to one decimal.

## Anchor selection

Each country is sampled at one or more **anchor** coordinates taken from
`public/data/airports/commercialAirports.generated.json`.

1. **`curated-region`** — for countries listed in `CURATED_COUNTRY_ANCHORS` in the generator.
   A single curated entry pins the anchor to the country's main travel gateway (better than the
   automatic pick for countries we merchandise). Multiple entries are used where one point is
   clearly unrepresentative; the first is the primary anchor.
2. **`airport-medoid`** — otherwise, take the highest available commercial tier
   (`major` → `regional` → `local`) and pick the airport closest to the mean coordinate of that
   tier group. Deterministic and independent of dataset ordering.
3. **`curated-capital`** — fallback for the six countries with no commercial airport in the
   dataset (`AD`, `LI`, `MC`, `PS`, `SM`, `VA`); capital-city coordinates are hard-coded.

Multi-anchor countries currently include AR, AU, BO, BR, CA, CL, CN, CO, DZ, EC, EG, ES, FI, HR,
ID, IN, JP, KR, KZ, MA, MX, MY, NG, NO, NZ, PE, PK, PT, RU, SA, SE, TR, TZ, US, VN, ZA.

`pnpm climate:validate` prints the exact anchor and multi-anchor counts for the committed dataset.

## Season derivation

`season` is derived **entirely from the existing curated editorial data** in
`data/countryTravelData.json` — it contains no measured data of any kind.

For each country and month:

| Input | Effect |
|-------|--------|
| month is in `bestMonths` | `base = 2` |
| month is in `avoidMonths` | `base = 0` |
| anything else (incl. `shoulderMonths`) | `base = 1` |
| `>= 1` event in that month | `boost += 0.5` |
| `>= 2` events in that month | `boost += 0.5` |
| `>= 1` public holiday in that month | `boost += 0.5` |

`boost` is capped at `1.0`. Then:

```
score = base + boost
score >= 2  → "high"
score >= 1  → "shoulder"
otherwise   → "low"
```

Guard rail: a month listed in `avoidMonths` can never be promoted above `shoulder`, no matter how
many events or holidays fall in it.

The canonical implementation is `deriveClimateSeason()` in `shared/countryClimateNormals.ts`; the
rule string and disclaimer are embedded in the generated document under `seasonDerivation`.

**Copy guidance:** phrase this as *"typically busy / quieter travel season"*, never as *"X% more
visitors"* or *"measured tourist volume"*.

## Refresh procedure

```bash
pnpm climate:generate                 # all countries (uses the on-disk cache)
pnpm climate:generate --only=TH,JP    # subset; untouched countries are preserved
pnpm climate:generate --limit=10      # smoke test
pnpm climate:generate --force         # ignore the cache and refetch
pnpm climate:generate --cached-only   # rebuild offline from the cache, never hit the network
pnpm climate:validate                 # verify before committing
```

- Raw Open-Meteo responses are cached under `tmp/climate-cache/` (gitignored), one file per
  anchor. Reruns are therefore resumable and cheap: a cache hit skips the network entirely.
  A cache entry is invalidated automatically when the window or the anchor coordinate changes.
- Requests are serialized with a `1200 ms` delay (override with `CLIMATE_REQUEST_DELAY_MS`) and
  retried up to 3 times with exponential backoff on `429`/`5xx`. A full refresh of ~240 anchors
  takes roughly 15 minutes.
- If an anchor fetch fails permanently, the previously committed record for that country is kept
  and the script exits non-zero listing the failures. Nothing is silently dropped.
- Commit the regenerated `data/countryClimateNormals.json` — this is the runtime source of truth.

### Open-Meteo daily quota (why the backfill is incremental)

Open-Meteo's free tier weights each request by `days × variables`, so one anchor (3,653 days ×
3 variables) is expensive. A full refresh of ~260 anchors **exceeds the free daily allowance** and
the API starts answering:

```json
{ "reason": "Daily API request limit exceeded. Please try again tomorrow.", "error": true }
```

The quota resets at 00:00 UTC and is shared across all `*.open-meteo.com` hosts. Because every raw
response is cached under `tmp/climate-cache/`, the practical workflow is:

1. Run `pnpm climate:generate` until it starts reporting sustained `429 (quota)` failures.
2. Resume the next UTC day — cached anchors are skipped instantly and only the gaps are fetched.
3. Once every anchor is cached, `pnpm climate:generate --cached-only` rebuilds the whole file
   offline in seconds.

### Coverage state

`pnpm climate:validate` always enforces the schema, but treats **incomplete coverage as a warning**
while the backfill is in flight, listing exactly which destination-guide countries are still
missing. Set `CLIMATE_VALIDATE_STRICT_COVERAGE=1` to turn that into a build failure — do this
permanently once every destination-guide country is covered.

`tests/unit/countryClimateNormalsValidation.test.ts` carries a `CLIMATE_BACKFILL_BACKLOG` list of
the guide countries still awaiting data. **That list must shrink, never grow.**

## Service API

```ts
import {
  getCountryClimate,
  getMonthClimate,
  getRainfallLevel,
} from '../services/countryClimateService';
```

| Function | Returns |
|----------|---------|
| `getCountryClimate(countryCode)` | `CountryClimateRecord \| undefined` |
| `getCountryClimateMonth(countryCode, month)` | `CountryClimateMonth \| undefined` (incl. `avgTempC`, `rainyDays`) |
| `getMonthClimate(countryCode, month)` | `{ avgHighC, avgLowC, precipitationMm, season } \| undefined` |
| `getCountryClimateMonths(countryCode)` | `CountryClimateMonth[]` (12 entries, or `[]`) |
| `getCountrySeason(countryCode, month)` | `ClimateSeason \| undefined` |
| `getCountryClimateRegions(countryCode)` | `CountryClimateRegion[]` (`[]` for single-anchor countries) |
| `hasMultipleClimateAnchors(countryCode)` | `boolean` |
| `getRainfallLevel(precipitationMm)` | `'dry' \| 'light' \| 'wet' \| 'very-wet' \| undefined` |
| `getMonthRainfallLevel(countryCode, month)` | same, looked up by country/month |
| `celsiusToFahrenheit(celsius)` | `number` (1 decimal) |
| `listClimateCountryCodes()` | `string[]` |
| `getClimateSourceMeta()` | `CountryClimateSource` (render `attribution`) |
| `getClimateSeasonDerivation()` | `{ signal, rule, disclaimer }` |

Country codes are case-insensitive and whitespace-trimmed. `month` is `1..12`. Every accessor
returns `undefined` / `[]` for unknown input and never throws. The country index is built lazily
once and memoized.

### Rainfall buckets

| Level | Monthly total |
|-------|---------------|
| `dry` | `< 25 mm` |
| `light` | `25–74 mm` |
| `wet` | `75–174 mm` |
| `very-wet` | `>= 175 mm` |

Thresholds live in `RAINFALL_THRESHOLDS_MM`. **UI must not invent its own thresholds** — use
`getRainfallLevel(...)` so labels stay consistent across surfaces.

## Known limitations

- **One point does not represent a country.** Even with multi-anchor coverage, the country-level
  `months` come from a single coordinate. Norway's numbers are Oslo's, not Tromsø's. For the ~30
  multi-anchor countries, `regions` exposes the spread; `hasMultipleClimateAnchors()` tells the UI
  when a "varies by region" hint is warranted.
- **Airport coordinates, not city centres.** Airports are typically outside the city and sometimes
  at a noticeably different elevation, which shifts temperature by a degree or two.
- **Reanalysis, not station observations.** ERA5 is a gridded model reanalysis (~25 km); coastal,
  island, and mountainous locations are smoothed toward their surroundings.
- **Normals, not forecasts.** These are 10-year averages. Never present them as a prediction for a
  specific trip, and never as a live weather forecast.
- **`rainyDays` uses a 1 mm threshold** on ERA5 daily totals; it is not directly comparable to
  station-based "rain days" published by national weather services.
- **Season is curated, not measured.** Repeat: it is an editorial signal derived from our own
  seasonality, event, and holiday data.
- **Coverage is still incomplete.** The dataset currently covers a subset of the 197 countries in
  `data/countryTravelData.json`; the rest are blocked on the Open-Meteo daily quota described
  above. `getCountryClimate(...)` returns `undefined` for them, so UI must handle a missing
  record as a normal state, not an error.
- **The window is fixed at 2015–2024.** It does not shift automatically; bump `WINDOW_START` /
  `WINDOW_END` in the generator when refreshing to a newer decade.
