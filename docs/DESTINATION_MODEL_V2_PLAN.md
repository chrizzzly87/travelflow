# Destination model V2: cities, islands, and neighbourhoods

Status: proposed follow-up to issue #451  
Last updated: 2026-08-17

## Outcome

Evolve the imported AtoBeach country shape into a source-independent travel knowledge model that can resolve and query:

```text
country → region/admin area → island → city → district → neighbourhood
                                      ↘ beach / airport / point of interest
```

The hierarchy must not be a rigid tree. Mallorca contains municipalities and cities, Bangkok contains districts and neighbourhoods, and a beach may relate to an island, city, and neighbourhood at the same time. Canonical places therefore use one primary parent for navigation plus typed relationships for every other association.

## What to improve from the source payload

The country API is useful as a source snapshot, but several fields should not remain embedded arrays:

- promote `cities`, `beaches`, and `airports` to independently addressable places;
- distinguish islands, cities, municipalities, districts, and neighbourhoods instead of treating them all as generic cities;
- split stable facts from volatile observations such as weather, exchange rates, safety notices, and event occurrences;
- attach provenance to each fact or observation, not only to the whole country record;
- keep upstream IDs in provider mappings instead of making them canonical IDs;
- retain sanitized source payloads and immutable hashes for update diffs and rollback;
- model multilingual names and aliases independently of English canonical slugs;
- represent uncertain matches and conflicts explicitly instead of silently overwriting them.

## Proposed canonical types

```ts
type PlaceKind =
  | 'country'
  | 'admin_area'
  | 'island'
  | 'city'
  | 'municipality'
  | 'district'
  | 'neighbourhood'
  | 'beach'
  | 'airport'
  | 'poi';

interface Place {
  id: string;                    // TravelFlow UUID, never a provider ID
  kind: PlaceKind;
  canonicalSlug: string;
  primaryParentId: string | null;
  countryCode: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  boundary: GeoJSON.Geometry | null;
  timezone: string | null;
  status: 'draft' | 'reviewed' | 'published' | 'retired';
}

interface PlaceName {
  placeId: string;
  locale: string;
  name: string;
  nameType: 'official' | 'common' | 'short' | 'historic' | 'alias';
  isPreferred: boolean;
}

interface PlaceRelation {
  fromPlaceId: string;
  toPlaceId: string;
  relation: 'contains' | 'part_of' | 'near' | 'gateway_for' | 'served_by';
  distanceMeters: number | null;
}

interface ProvenancedFact<T> {
  value: T;
  originUrl: string;
  provider: string;
  observedAt: string;
  validFrom: string | null;
  validTo: string | null;
  confidence: number;
  reviewStatus: 'unreviewed' | 'accepted' | 'rejected' | 'superseded';
}
```

## Database structure

TravelFlow already has a canonical travel-knowledge model in Supabase. Reuse it rather than creating a parallel place database. The new `destination_*` tables are provider-specific staging and read projections; reviewed source changes should flow into the existing `travel_*` model.

| Table | Purpose |
| --- | --- |
| `travel_entities` (existing) | Canonical identity, entity type, parent, point/bounds, lifecycle and scoring |
| `travel_entity_names` (existing) | Localized names, aliases, exonyms, and search normalization |
| `travel_entity_facts` (existing) | Typed facts with source, confidence, review state and validity windows |
| `travel_sources` / `travel_source_runs` / `travel_source_snapshots` (existing) | Source licence, crawl audit and immutable source evidence |
| `travel_change_candidates` (existing) | Human-review queue for ambiguous or conflicting imported changes |
| `travel_entity_relations` (new) | Non-tree containment, proximity, gateway and service relationships |
| `travel_provider_mappings` (new) | Provider IDs/URLs to canonical entity matches, confidence and review status |
| `travel_event_occurrences` (new) | Dated event occurrence, precision, status, verification and expiry |
| `destination_country_profiles` (existing projection) | Fast country endpoint reads while canonical facts live in `travel_*` |

Extend the existing `travel_entities.entity_type` constraint from its current country/region/city/neighborhood/POI/port/campground set to include `admin_area`, `island`, `municipality`, `district`, `beach`, and `airport`. Keep US-English `neighborhood` as the database enum value while the UI may render localized spelling.

Keep `destination_source_records` and `destination_source_record_versions` private. They are the sanitized AtoBeach staging evidence used by the adapter, not the public API contract or a second canonical knowledge graph.

## City-level information

Each city profile should support:

- identity, aliases, coordinates, boundary, timezone, country and admin area;
- suggested stay length and traveller/audience fit;
- arrival gateways and transfer options;
- local transport modes, payment methods, late-night availability and accessibility;
- month-by-month climate and visit suitability with a published method;
- districts and neighbourhoods with clear containment;
- beaches, sights, markets, parks, nightlife areas and day-trip gateways;
- typical cost bands with currency, observation date and source;
- safety, health, entry and disruption notices with validity windows;
- recurring events separated from verified dated occurrences;
- original editorial summary plus source-attributed factual modules.

## Neighbourhood-level information

A neighbourhood profile should answer practical stay decisions without stereotyping residents:

- `bestFor`: families, first visit, nightlife, food, beaches, business, quiet stays;
- `characterTags`: compact controlled vocabulary, backed by reviewed evidence;
- accommodation and cost bands with observation dates;
- transit stations, walking conditions, airport/centre transfer estimates;
- day/night noise profile and nightlife intensity;
- accessibility notes and common terrain barriers;
- nearby highlights and realistic walking/transit times;
- boundary or approximate centroid with `geometryPrecision`;
- short original description and field-level sources;
- safety notices only when sourced, time-bounded, geographically precise, and reviewed.

AtoBeach does not currently provide a reliable neighbourhood layer. Seed candidates from official city/open geographic sources such as administrative open data, OpenStreetMap and Wikidata under their respective licences; use official tourism and transit sources for travel facts. Never infer neighbourhood boundaries from marketing copy.

## Update and matching workflow

1. Fetch each authorized/licensed source into a versioned source record.
2. Sanitize referral URLs before persistence and retain removed parameter names.
3. Diff sanitized hashes; create a source version only when content changes.
4. Resolve provider records through `travel_provider_mappings`.
5. Auto-accept exact stable-ID matches; write ambiguous name/coordinate matches to `travel_change_candidates` for review.
6. Write accepted fact observations to `travel_entity_facts` instead of overwriting facts in place.
7. Select the current canonical fact by source priority, validity, freshness, confidence, and review status.
8. Rebuild query profiles only after a complete import succeeds.
9. Expire stale event occurrences, alerts, prices, exchange rates, and weather forecasts automatically.
10. Record run counts, failures, source terms/licence, crawler version, and origin URLs.

## Endpoint shape

```text
GET /api/destinations?type=country|island|city|neighbourhood
GET /api/destinations/{country}
GET /api/destinations/{country}/{city-or-island}
GET /api/destinations/{country}/{city}/neighbourhoods
GET /api/destinations/{country}/{city}/neighbourhoods/{neighbourhood}
GET /api/places/{placeId}/relations?type=near|served_by
GET /api/places/{placeId}/events?from=YYYY-MM-DD&to=YYYY-MM-DD
```

Responses should use stable camelCase DTOs and include compact provenance by default:

```json
{
  "provider": "official-tourism-board",
  "originUrl": "https://example.org/source",
  "observedAt": "2026-08-17T12:00:00Z",
  "validTo": null,
  "reviewStatus": "accepted"
}
```

Raw provider payloads and internal matching candidates must never be returned by public endpoints.

## Delivery phases

1. **Canonical model extension** — expand `travel_entities` types, add relations/provider mappings, spatial indexes and typed API DTOs.
2. **Staging adapter** — convert AtoBeach `destination_source_records` cities/beaches/airports into `travel_change_candidates` without auto-publishing uncertain matches.
3. **City profiles** — migrate the current 482 city guides into reviewed `travel_entities` and `travel_entity_facts`, then attach arrivals, seasonality, events and nearby islands.
4. **Island corrections** — model Mallorca, Ibiza, Menorca, Phuket, Koh Samui and similar places consistently.
5. **Neighbourhood pilot** — Bangkok, Palma and one contrasting city; validate boundaries, navigation and content review workflow.
6. **Events and volatile facts** — occurrence expiry, official-source verification and freshness monitoring.
7. **Public rollout** — redirects are unnecessary because canonical English route slugs remain stable; add deeper routes and sitemap entries.

## Acceptance criteria

- every public fact exposes at least one `originUrl` and observation timestamp;
- source-only payloads remain inaccessible to `anon` and `authenticated` roles;
- no referral URL contains a tracking parameter, while referral metadata remains queryable;
- an island can contain cities and relate to beaches/airports without being cast as a city;
- Bangkok resolves city → district/neighbourhood and Mallorca resolves island → municipality/city;
- imports are idempotent, resumable, and preserve the first-seen version after partial failures;
- city/neighbourhood queries use indexed relational fields rather than scanning country JSON arrays;
- ambiguous provider matches cannot become published places without review.
