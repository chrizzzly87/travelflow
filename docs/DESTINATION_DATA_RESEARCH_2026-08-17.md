# Destination data and inspiration research

Research date: 2026-08-17 (Europe/Berlin)

## Executive summary

AtoBeach exposes useful country JSON and server-rendered city/island-like pages, but this should be treated as a product/schema reference rather than a source to clone without permission. Its first-party [`robots.txt`](https://atobeach.com/robots.txt) explicitly disallows `/api/` (except `/api/img`), the API has no published documentation or reuse licence, and the site footer asserts that all rights are reserved. A safe implementation should reproduce the information architecture with facts from licensed/open/official sources, original summaries, and per-field provenance.

The strongest reusable model is a destination hierarchy (`country -> region/island/city -> place/event`) with time-aware facts. Islands must be a first-class type rather than being placed in a generic `cities` array: AtoBeach treats Ibiza, Menorca, Koh Samui, Phuket, and Phi Phi Island as city-route entries, while Mallorca itself is absent and only Palma is represented as a city on Mallorca. See [Spain JSON](https://atobeach.com/api/countries/spain/), [Palma](https://atobeach.com/spain/palma), [Ibiza](https://atobeach.com/spain/ibiza), [Menorca](https://atobeach.com/spain/menorca), [Koh Samui](https://atobeach.com/thailand/koh-samui), and [Phi Phi Island](https://atobeach.com/thailand/phi-phi-island).

Rove.me demonstrates a strong month-by-month seasonality and event experience, but its Thailand page currently mixes a 2026 title with many 2023-2025 event dates and says it was last updated on 2024-11-15. It is therefore useful as interaction inspiration, not a trustworthy live event feed. See [Rove Thailand](https://rove.me/to/thailand) and [Rove terms](https://rove.me/terms).

## AtoBeach endpoints and observed contracts

These are observed, undocumented endpoints. Successful access is not evidence of permission to bulk copy.

| Endpoint | Response | Observed purpose |
| --- | --- | --- |
| [`GET /api/countries/`](https://atobeach.com/api/countries/) | JSON array | 181 country summaries: `name`, ISO alpha-2 `code`, `slug`, `region`, `popularity`, `content_updated_at` |
| [`GET /api/countries/{country}/`](https://atobeach.com/api/countries/indonesia/) | JSON object | Full country record; trailing slash works and is the form supplied by the user |
| [`GET /api/countries/{country}/airports`](https://atobeach.com/api/countries/thailand/airports) | JSON array | Full airport list with `iata` and `name` |
| [`GET /api/countries/{country}/map`](https://atobeach.com/api/countries/thailand/map) | PNG | Rendered country map; width query is used by the site (for example `?w=1280`) |
| [`GET /api/cities/{country}/{city}/map`](https://atobeach.com/api/cities/spain/palma/map) | PNG | Rendered city map |
| `GET /api/countries/{country}/cities/{city}` | 404 JSON | No observed public city-detail JSON contract |
| [`GET /{country}/{city}`](https://atobeach.com/spain/palma) | server-rendered HTML | City detail is embedded in the page payload rather than exposed through an observed JSON detail endpoint |

On 2026-08-17, API responses included `Cache-Control: no-cache, private`, an HTTP-only session cookie, `Vary: Origin`, and `X-RateLimit-Limit: 180`; an arbitrary `Origin` did not receive an `Access-Control-Allow-Origin` header. This means a browser client on another origin should not call it directly, and `180` must not be interpreted as a stable period-based quota because the response did not document the window. The authoritative access warning remains AtoBeach's [`robots.txt`](https://atobeach.com/robots.txt).

### Country detail shape

The [Indonesia response](https://atobeach.com/api/countries/indonesia/) and [Spain response](https://atobeach.com/api/countries/spain/) expose the following reusable field groups:

- Identity and geography: `id`, `name`, `code`, `slug`, `description`, `region`, coordinates, timezone, popularity.
- Practical basics: currency, calling code, current exchange rate/base, plug/voltage/frequency, driving side/licence/speed/alcohol limits, emergency numbers.
- Safety and entry: warning, safety tips, extra tips, entry requirements with a government source URL, and recent update messages/timestamps.
- Money and connectivity: card acceptance/brands/hotlines, tipping categories, roaming, example local data package, networks, Wi-Fi coverage/speed, and eSIM offer.
- Health and help: health/insurance summaries, vaccination flag, and embassy name/contact/address/website.
- Discovery: short weather forecast, beaches, airports/count, FAQs, related destinations, and a generic `cities` list.

The model mixes durable facts, fast-changing facts, audience-specific guidance, marketing copy, and affiliate offers in one response. Those groups need separate provenance and freshness policies in our implementation.

### City payload shape and island handling

The server payload on [Palma](https://atobeach.com/spain/palma) contains:

- identity, parent country facts, coordinates, timezone, population, intro, update time;
- nearby airports and beaches with distances (beaches also include coordinates and images);
- short forecast plus 12 monthly climate points (`max_temp`, `rain_days`);
- things to do with category, website, and distance;
- FAQs and nearby destination links.

The page explicitly describes Palma as a city on Mallorca, but the [Spain country JSON](https://atobeach.com/api/countries/spain/) lists Palma, Ibiza, and Menorca while it does not list Mallorca. Ibiza and Menorca resolve as detail routes even though the names can refer to islands. Thailand similarly places island destinations in `cities`, including Koh Samui and Phi Phi Island in the [Thailand country page](https://atobeach.com/thailand). This is partial island support with ambiguous typing, not a sound hierarchy.

Recommended hierarchy:

```text
country (Spain)
  region/island (Balearic Islands)
    island (Mallorca)
      city (Palma)
      locality/resort
      beach / POI / event
```

Use `destination.type` (`country`, `region`, `island`, `city`, `locality`) and a parent relation, rather than one table/array called `cities`. Permit multiple containment relationships when a place belongs to both an administrative and a travel region.

### “Top 50” result

Sorting the 181 entries from [`/api/countries/`](https://atobeach.com/api/countries/) by descending `popularity` produces only 29 positive scores. Positions 30-50 are zero-score countries in API/alphabetical order, so AtoBeach does **not** provide a defensible top-50 ranking.

| Rank | Country | Score | Rank | Country | Score |
| ---: | --- | ---: | ---: | --- | ---: |
| 1 | Thailand | 100 | 26 | Seychelles | 33 |
| 2 | Spain | 95 | 27 | Mauritius | 30 |
| 3 | France | 90 | 28 | Fiji | 28 |
| 4 | Italy | 88 | 29 | Sri Lanka | 25 |
| 5 | Greece | 85 | 30 | Albania | 0 |
| 6 | Portugal | 82 | 31 | Algeria | 0 |
| 7 | Turkey | 80 | 32 | American Samoa | 0 |
| 8 | Mexico | 78 | 33 | Andorra | 0 |
| 9 | Indonesia | 75 | 34 | Angola | 0 |
| 10 | Brazil | 72 | 35 | Anguilla | 0 |
| 11 | Maldives | 70 | 36 | Antigua and Barbuda | 0 |
| 12 | Australia | 68 | 37 | Argentina | 0 |
| 13 | Philippines | 65 | 38 | Armenia | 0 |
| 14 | Barbados | 63 | 39 | Aruba | 0 |
| 15 | Jamaica | 60 | 40 | Austria | 0 |
| 16 | Dominican Republic | 58 | 41 | Azerbaijan | 0 |
| 17 | Cuba | 55 | 42 | Bahamas | 0 |
| 18 | Costa Rica | 53 | 43 | Bahrain | 0 |
| 19 | Vietnam | 50 | 44 | Bangladesh | 0 |
| 20 | Cyprus | 48 | 45 | Belgium | 0 |
| 21 | Croatia | 45 | 46 | Belize | 0 |
| 22 | Morocco | 42 | 47 | Benin | 0 |
| 23 | Egypt | 40 | 48 | Bermuda | 0 |
| 24 | South Africa | 38 | 49 | Bhutan | 0 |
| 25 | Tanzania | 35 | 50 | Bolivia | 0 |

For a real launch set, select countries through an explicit, documented measure (for example product demand, existing TravelFlow searches/trips, or a licensed tourism-arrival dataset) and store the metric, period, and source. Do not label the 21 zero-score tail as “top” countries.

## Referral-link normalization

The country response contains a Saily eSIM offer whose purchase URL includes `utm_source=atobeach`; the rendered country page marks the link `rel="sponsored"`. See the [Indonesia JSON](https://atobeach.com/api/countries/indonesia/) and [Thailand page](https://atobeach.com/thailand).

Recommended normalized record:

```json
{
  "url": "https://saily.com/esim-indonesia/",
  "provider": "saily",
  "relationship": "referral",
  "is_referral": true,
  "tracking_parameters_removed": ["utm_source"],
  "source": "atobeach",
  "source_observed_at": "2026-08-17T00:00:00Z"
}
```

Strip known tracking keys (`utm_*`, `ref`, `referrer`, `affiliate`, `aff`, click IDs) while preserving functional parameters such as product, locale, dates, or inventory identifiers. Store removed **key names**, not third-party attribution values, unless there is a clear business/legal need. Render future monetized links with an explicit referral disclosure and `rel="sponsored noopener noreferrer"`.

## AtoBeach information architecture

The [Thailand page](https://atobeach.com/thailand) uses a compact country overview followed by practical cards. Its visible order is broadly:

1. Hero, description, country/currency context.
2. Travel warning, map, five-day weather, seasonal SPF.
3. Entry requirements, safety, affiliate eSIM.
4. Driving, health, cards, tipping, mobile, electrical, Wi-Fi, emergency/calling, embassy.
5. Airports, recent updates, beaches, FAQs, city links, related countries.

The [Palma page](https://atobeach.com/spain/palma) shifts appropriately to local decision support: forecast, know-before-you-go, 12-month climate, nearby beaches, attractions, arrival airport, FAQs, and nearby places. This country/locality differentiation is worth retaining.

Data-quality warning: AtoBeach's own current payload can contradict itself. In the [Indonesia JSON](https://atobeach.com/api/countries/indonesia/), entry tips describe a paid 30-day visa on arrival while an FAQ says British citizens can enter visa-free for 30 days. In the [Thailand page](https://atobeach.com/thailand), entry tips say tourism visits can be 60 days while an FAQ says 30 days. Entry/safety/health facts therefore need a traveller nationality, `valid_from`/`valid_to`, primary government source, retrieval timestamp, and a human-review workflow; a generic FAQ should never override the sourced rule.

## Rove.me events and best-time pattern

The [Rove Thailand page](https://rove.me/to/thailand) provides:

- a 12-month “best time” score chart (observed scores: 89, 89, 90, 75, 79, 54, 79, 68, 76, 100, 87, 99);
- a narrative that distinguishes Thailand's regional monsoon patterns;
- 70 experiences filterable by month and theme;
- entries typed as weather, food, activity, nature, event, and related themes;
- schedule text, applicable months, title, short summary, map markers/bounds, destination, and nearby destinations in its rendered payload.

The interaction is valuable; the data cannot be assumed current. The same page includes numerous past 2023-2025 dates, advertises itself as 2026, and reports “Last updated: Nov 15, 2024.” Event occurrences should be separate from the underlying event definition and should expire automatically.

Recommended fields:

```text
seasonality_month(destination_id, month, score, score_method, source_id, observed_at)
event(id, destination_id, name, category, recurrence_rule, official_url, source_id)
event_occurrence(event_id, starts_at, ends_at, date_precision, status, verified_at)
event_location(event_id, place_id, latitude, longitude)
```

Do not copy Rove's prose, images, score compilation, or event catalogue into production without a licence. Its [`robots.txt`](https://rove.me/robots.txt) does not disallow destination pages, but robots permission is not a content licence; [Rove's terms](https://rove.me/terms) describe the site as a consumer travel-information/booking service and provide materials “as is,” without granting republication rights. Prefer official event organisers/tourism boards and climate-derived seasonality with a documented scoring method. If Rove is desired as a feed, request a commercial licence/API.

## Comparable destination/planning products

| Product | Useful first-party pattern | What it suggests for TravelFlow |
| --- | --- | --- |
| [Lonely Planet: Thailand](https://www.lonelyplanet.com/destinations/thailand) | Separates things to do, best time, pre-trip knowledge, transport, money/costs, family travel, road trips, connectivity, and nested destinations such as Phuket, Bangkok, and Ko Samui | Treat audience/use-case guides and transport/cost planning as linked modules, not one long generic description |
| [Rough Guides: Thailand](https://www.roughguides.com/thailand/) | Presents motivations, practical “things to know,” ideal duration/itineraries, best places, accommodation, travel tips, and maps | Add “why go,” suggested duration, itinerary templates, and regional choices before dense practical facts |
| [Wanderlog: Thailand planner](https://wanderlog.com/tp/86651/thailand-trip-planner) | Puts dates, save actions, top destinations/attractions, map and itinerary together; supports collaboration, reservation import, expenses, lists, and personalised suggestions | Make inspiration immediately actionable: save to a dated trip/day, map it, estimate travel time, and collaborate |
| [Tripomatic itinerary planner](https://tripomatic.com/en/features/trip-itinerary-planner) | Day-by-day drag/drop, shortlist, custom places, hotels, notes/times, map routing, realistic travel times, and export/offline use | Keep “considering” separate from scheduled stops and surface route feasibility while planning |
| [KAYAK: Thailand guide](https://www.kayak.com/Thailand.238.dc.guide) | Integrates things to do, when to visit, indicative package costs, entry, and arrival by plane/train/car/bus/boat | Connect inspiration to cost and arrival logistics, while clearly labelling estimates and their dates |

## Recommended minimum dataset and endpoint

The minimum useful destination detail should include:

- stable identity: canonical slug, names/aliases, type, parents, coordinates, timezone, ISO codes;
- editorial discovery: original summary, “why go,” tags/interests, audience fit, suggested duration;
- seasonality: monthly climate/score, regional caveats, crowds/prices where sourced, methodology;
- logistics: arrival hubs, local transport, border/entry links, money, connectivity, accessibility;
- safety/health: concise summaries that always link to authoritative live sources and show retrieval time;
- places: cities, islands, regions, attractions, beaches, with type, coordinates, distance and source;
- events: reusable event plus dated occurrences, verification/status and official organiser URL;
- planning actions: save/shortlist/add to day, map/routing and approximate visit duration;
- provenance: source URL/licence, fetched/verified timestamps, valid period, confidence and reviewer;
- monetisation: canonical external URL plus explicit referral metadata, never embedded tracking by default.

A simple read contract can be hierarchical without mirroring AtoBeach:

```http
GET /api/destinations?type=country&limit=50&sort=popularity
GET /api/destinations/{slug}?include=children,seasonality,events,practical
GET /api/destinations/{slug}/children?type=island,city,locality
GET /api/destinations/{slug}/events?from=2026-10-01&to=2026-12-31
```

Return typed, versioned facts and provenance; paginate large child/place collections. A country response may link to children, but island/city records should have their own IDs and endpoints. Never use an upstream URL slug as the durable primary key.

## Legal and technical guardrails

1. Obtain written permission before bulk fetching or cloning AtoBeach's API. Its [`robots.txt`](https://atobeach.com/robots.txt) explicitly disallows `/api/`.
2. Do not copy editorial descriptions, FAQs, tips, event summaries, images, or a compiled scoring dataset. Model the facts and interactions, then source facts independently and write original copy.
3. Record source/licence/provenance per fact. Government entry, safety, and health guidance must retain audience/nationality and validity dates.
4. Respect upstream rate limits and terms even after permission; use conditional requests/backoff and a scheduled ingestion job, never a client-side proxy around CORS.
5. Treat maps and images as separate licensed assets. A publicly reachable PNG is not automatically reusable.
6. Run automated consistency checks (for example FAQ vs entry rule), expiry checks for event occurrences/advisories, and manual review for high-stakes fields.

## Recommended decision

Proceed with the destination hierarchy, referral-normalisation model, country/locality page split, monthly seasonality UI, and dated event occurrences. Do **not** proceed with a wholesale AtoBeach/Rove data clone until licences or written permissions exist. Seed an initial country set from an explicit TravelFlow-owned ranking and populate it from official/open/licensed sources with provenance.
