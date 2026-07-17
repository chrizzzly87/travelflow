# Create Trip Product Strategy and Market Position

Status: active product summary

Research checked: 2026-07-17

Implementation branch: `codex/journey-spec-thailand-foundation`

## 1. Executive summary

TravelFlow's strongest opportunity is not to become another blank itinerary editor or generic AI chat. It should own the moment before detailed planning: turn a traveler's fuzzy intent into two or three feasible, explainable route concepts in seconds, backed by versioned destination knowledge, then let the traveler shape one into a full trip.

The proposed position is:

> The fastest trustworthy way to decide the shape of a trip, with enough local context to understand why the route fits.

That creates a defensible gap between inspiration/tracking products such as Polarsteps and Skratch, and logistics-heavy planners such as Wanderlog and Stippl. TravelFlow can still grow into the full planning lifecycle, but its memorable first win should be a source-backed route reveal rather than an empty day planner.

The Thailand foundation now proves the core architecture: structured `JourneySpec`, first-class cities and neighborhoods, bounded two-stage retrieval from an active country pack, premade route concepts, deterministic matching, immediate editable skeletons, typed activity metadata, a searchable admin catalogue, and a reusable map contract. The next product work should add constrained AI personalization and traveler-aware planning before expanding globally.

The follow-up trip visualization direction is defined in [JOURNEY_SPEC_SIDEBAR_CONCEPTS.md](./JOURNEY_SPEC_SIDEBAR_CONCEPTS.md). Its synchronized Journey Lens and Route Storyboard remain paused until the fast-path experience is approved; no further large TripView layout change should ship as part of this foundation.

## 2. What the current codebase did well and where it was constrained

Before this branch, both create-trip surfaces ultimately optimized for collecting prompt fields and starting one AI generation request. They supported broad preferences, but the planning model still had four structural limitations:

1. Destinations were mostly text/country inputs rather than canonical country, region, city, neighborhood, and place entities.
2. The product assumed a route across multiple destinations more naturally than a single-city weekend, one-base trip, or explicit city/day-trip structure.
3. The first useful answer waited for generation even when a premade route or deterministic skeleton could answer immediately.
4. Destination facts, recommendations, and model prose did not share one versioned evidence contract, making consistency and repeatability difficult.

The additive foundation changes that boundary:

- `shared/journeySpec.ts` defines one versioned planning input across creator experiences.
- `data/travelKnowledge/` contains a validated Thailand pack with stable entity IDs, facts, tags, activities, neighborhoods, templates, and route legs.
- `services/travelKnowledgeService.ts`, `services/travelTemplateMatcher.ts`, and the journey compiler services return useful concepts without waiting for AI.
- `pages/CreateTripShapeLabPage.tsx` proves the five-step shape flow and route reveal behind a default-off rollout.
- `shared/mapPresentation.ts` and `shared/mapPresentationScene.ts` keep the map/route presentation layer independent from wizard and AI state.
- `docs/supabase.sql` separates published travel knowledge from immutable sources, snapshots, candidates, reviews, and dataset artifacts.

The current foundation is intentionally Thailand-first. It is not yet the finished public creator, a full family/group preference system, or a global knowledge catalog.

## 3. Competitor review

The inputs below are inferred from each product's public feature surfaces and the records needed to provide those features; they are not a claim about private internal schemas.

| Rank | Product | Strongest job | Information visibly collected or managed | What to learn from it | Gap TravelFlow can own |
| ---: | --- | --- | --- | --- | --- |
| 1 | [Stippl](https://www.stippl.io/) | End-to-end planning, collaboration, sharing, and reliving | Destinations, route stops, dates, accommodations, transport, activities, bookings, budgets, packing, collaborators, journals, media | Its lifecycle continuity, visual route builder, reusable itineraries, and group planning make it the closest product benchmark. Its [business builder](https://www.stippl.io/business/trip-building) also shows the value of drag-and-drop routes, live maps, day blocks, and templates. | Make the initial route decision faster, more explainable, and grounded in curated destination evidence rather than beginning with detailed manual construction. |
| 2 | [Wanderlog](https://wanderlog.com/) | Detailed itinerary and logistics workspace | Places, timed activities, lodging, flights, reservations and attachments, routes, budgets and split expenses, lists, collaborators, email imports | It sets the bar for map/itinerary coexistence, reservation import, route optimization, budgeting, offline access, and real-time group editing. | Recommend the right trip shape and bases before asking the traveler to micromanage days, and preserve source/freshness provenance for the recommendation. |
| 3 | [Polarsteps](https://www.polarsteps.com/) | Tracking, storytelling, sharing, and post-trip memory | Planned stops, travel route/location, steps, dates, photos, videos, notes/stories, privacy audience, visited-country statistics | It makes the full travel lifecycle emotionally rewarding and turns passive route data into stats, reels, and books. | Connect the same canonical trip graph to both planning and later travel memory, while remaining substantially stronger at pre-trip decisions. |
| 4 | [Skratch](https://www.skratch.world/) | Travel identity, passport map, and bucket list | Visited and wanted countries, regions, cities, attractions, trip timeline, visa context, eSIM destination | It makes lightweight progress, collection, and travel identity fun without requiring a full itinerary. | Let route planning grow a canonical personal travel graph and passport automatically, rather than running planning and travel identity as separate products. |

Adjacent specialist benchmarks matter for future umbrella products:

- [Roadtrippers RV GPS](https://roadtrippers.com/rv/rv-gps/) asks for vehicle dimensions, weight, and propane, then combines restriction-aware routing with RV parks and campgrounds.
- [RoadChapter](https://roadchapter.de/) combines European camping inventory with routes based on vehicle height, width, and weight.
- [Pilot's cruise planner](https://www.pilotplans.com/cruise-planner) treats each port as a bounded day and emphasizes ship, port, dates, meeting times, map distance, and return deadlines.
- Cruise-line apps such as [Norwegian](https://www.ncl.com/cruise-preparation/downloads/app) and [Disney Cruise Line](https://disneycruise.disney.go.com/en/faq/navigator-app/features/) center the official ship itinerary, bookings, excursions, and a personal onboard schedule.

## 4. Market gap and product positioning

Most competitors are strongest in one of four established categories:

- inspiration and travel identity
- itinerary editing and logistics
- in-trip tracking and sharing
- specialist routing or booking

The under-served job is a high-confidence first decision:

- Which cities or bases fit this duration and traveler setup?
- Is this a city break, hub with day trips, circuit, or multi-country route?
- Which neighborhood is the right base?
- What are the tradeoffs between the best two or three route shapes?
- Which claims are current, sourced, editorial, or uncertain?

TravelFlow should position around a **route-first, evidence-aware planning graph**:

1. Structured geography and feasibility decide what is possible.
2. Curated country packs explain what is worth considering.
3. Traveler context ranks what is suitable.
4. AI helps interpret wishes and explain tradeoffs, but does not invent the factual substrate.
5. The selected graph continues into itinerary editing, collaboration, in-trip use, and travel memory.

This position is more specific than “AI trip planner,” but broad enough to support the main app and dedicated child applications.

## 5. Biggest product changes, ranked

| Priority | Change | Why it matters | Current status |
| --- | --- | --- | --- |
| P0 | Make trip shape the first planning decision | Prevents a single-city weekend, hub trip, and country circuit from being forced through the same multi-stop form. | Hidden Thailand flow implemented. |
| P0 | Use canonical cities, neighborhoods, places, and route legs | Makes selections stable, searchable, reusable, sourceable, and compatible with maps and future products. | Thailand foundation implemented. |
| P0 | Reveal several feasible route concepts before day planning | Creates a fast, fun decision moment and avoids waiting for a full itinerary to learn that the route is wrong. | Deterministic reveal implemented; visual refinement remains. |
| P0 | Govern travel knowledge as versioned data, not prompt prose | Improves consistency, speed, provenance, reviewability, and rollback. | Schema, source registry, ingestion, private snapshots, review queue, deterministic artifacts, and atomic activation/rollback implemented; broader source adapters remain gated. |
| P1 | Add a progressive traveler setup | Families, couples, solo travelers, friend groups, accessibility needs, dietary needs, and audience context should change ranking without making the default wizard long. | Contract extension planned. |
| P1 | Add group preference negotiation | Multi-traveler planning needs per-person must-haves, avoids, optional votes, and conflict explanations instead of one merged free-text prompt. | Planned. |
| P1 | Enrich progressively after the skeleton | Neighborhoods, activities, dishes, prices, practical notes, and live facts should stream in independently while the route remains editable. | Deterministic brief/enrichment baseline implemented. |
| P1 | Make the route reveal the visual signature | Important choice cards can use bold color, squircle geometry, tactile selection, and restrained motion while the surrounding application becomes flatter and calmer. | Visual system planned. |
| P2 | Connect planning to passport and trip memory | Canonical entities make visited places, stats, journals, and repeat-trip preferences almost free downstream value. | Future lifecycle work. |
| P2 | Launch specialist child apps on the shared graph | Camper and cruise products need different constraints but can reuse places, facts, activities, accounts, and review operations. | Contracts reserved; specialist engines deferred. |

## 6. Adaptive use cases

The wizard should branch on trip shape and only ask questions that can materially change the result.

| Use case | Minimum inputs | Planning behavior | Important output |
| --- | --- | --- | --- |
| Single-city weekend | City, dates/duration, traveler setup, pace, interests | Rank neighborhoods, cluster activities, offer zero to two day trips, avoid unnecessary route legs | Best base, compact area plan, weather-proof alternatives, realistic opening-day/departure-day load |
| One base plus day trips | Base city or region, duration, transfer tolerance, interests | Keep accommodation stable; rank day trips by travel time, operating days, and value | Base comparison, day-trip menu, return feasibility |
| Single-country circuit | Country, entry/exit, duration, base-change limit, pace | Match templates and allocate nights while respecting transfer budgets | Two or three route concepts with tradeoffs and sourced transfers |
| Multi-country trip | Countries or anchors, entry/exit, duration, transport preference | Apply border/transport feasibility and minimize low-value hops | Route order, gateway logic, country-level time allocation |
| Group trip | Shared trip shape plus per-person preferences | Separate hard constraints from votes; show conflicts and who benefits from each concept | Consensus score, unresolved conflicts, optional variants |
| Family trip | Ages, stroller needs, nap/bedtime rhythm, mobility, food constraints | Prefer short transfers, family-suitable bases and activities, flexible backup options | Age/evidence-specific suitability, facilities, duration, weather fallback |
| LGBTQ+ traveler context | Desired scene/community, comfort priorities, legal/social context | Rank evidence-backed scene and community signals; distinguish venue self-attestation, editorial context, and current legal facts | Nuanced context and provenance, never a universal “safe” promise |
| Accessible trip | Mobility and sensory requirements, equipment, assistance needs | Treat verified access constraints as hard filters and unknown access as uncertainty | Verified facilities, unknowns, contact/check-ahead actions |

### Audience tagging rules

`family_friendly`, `gay_friendly`, or `accessible` must not be unsupported global booleans.

- Activity suitability can carry age range, duration, physical intensity, facilities, evidence source, and review date.
- Place context can carry family-activity supply, stroller practicality, LGBTQ+ scene/community presence, accessibility evidence, and relevant legal/social facts.
- Venue attributes can be official, self-attested, editorial, or community-reported and must say which.
- Sensitive safety or identity context needs a source, geography, observed date, confidence, and expiry.
- Unknown must remain different from false.

## 7. Recommended wizard

The fastest default path is five short decisions and a reveal:

1. **What kind of trip is this?** City break, one base and day trips, country route, multi-country, road trip, or “help me choose.”
2. **Where are the anchors?** Country, city, region, entry/exit, and must-visit places with first-class city selection.
3. **When and how long?** Exact dates or flexible duration/season.
4. **Who is traveling?** One-tap solo/couple/friends/family first; expand only when ages, accessibility, dietary, or per-person preferences matter.
5. **What should it feel like?** Pace, transfer tolerance, base changes, and a small set of visual interest cards.
6. **Route reveal.** Compare up to three route concepts with “why it fits,” tradeoffs, transfer load, neighborhoods, and a concise knowledge preview.

Advanced constraints stay behind “Tune this trip.” Previous traveler and pace settings can prefill later trips. The selected route opens as an editable map/timeline immediately; day-level enrichment continues afterward.

## 8. Travel knowledge and retrieval architecture

TravelFlow should use a hybrid retrieval system, not an embeddings-only RAG database.

### Structured core

- canonical country, region, city, neighborhood, POI, port, and campground entities
- localized names and aliases
- typed facts with source, observation date, validity, confidence, and review status
- evidence-aware tags
- versioned route templates, stops, legs, and localized copy
- traveler and trip-shape compatibility features

### Retrieval path

1. Resolve text selections to canonical entities.
2. Apply hard filters for geography, dates, duration, transport, traveler constraints, and freshness.
3. Retrieve a bounded country or regional context from the active Supabase artifact, with an immutable bundled fallback.
4. Rank templates, neighborhoods, activities, and day trips deterministically.
5. Use lexical/vector retrieval only for free-text wishes and long-tail editorial notes.
6. Let the model propose a constrained patch that can select only known IDs and explain the result.
7. Validate IDs, source coverage, transfers, duplicates, and hard constraints.
8. Persist the dataset, template, ranker, prompt, and model versions with the trip.

This is faster than putting every fact into a vector database, produces stable answers for identical inputs, and makes citations and rollback practical.

### Implemented Thailand checkpoint

- The comparison step retrieves at most three templates, two neighborhoods per city, and two POIs per city.
- Selecting one route retrieves a deeper, template-pinned context with up to four neighborhoods and six POIs per city.
- The route reveal visibly reports source, dataset/retriever version, retrieval time, payload size, selected/source counts, and zero AI calls.
- Opening the base compiles an editable trip locally and preserves the retrieval receipt plus canonical entity IDs.
- Researched Bangkok activities expose structured duration, hours, pricing, booking, dress, audience, practical, freshness, and source fields; absent data stays absent.
- The admin travel-knowledge workspace opens on a searchable published catalogue and keeps ingestion candidates in a separate review queue.

This is a structured retrieval/RAG system, but it is not yet semantic or fully personalized. Vector retrieval for free-text wishes and the AI patch step are open. The existing classic generator still uses the large-prompt generation path and remains useful as the comparison baseline.

## 9. Continuous update plan

The detailed runbook is in [TRAVEL_KNOWLEDGE_OPERATIONS_PLAN.md](./TRAVEL_KNOWLEDGE_OPERATIONS_PLAN.md) and [TRAVEL_KNOWLEDGE_DEPLOYMENT_RUNBOOK.md](./TRAVEL_KNOWLEDGE_DEPLOYMENT_RUNBOOK.md).

### Pipeline

1. Register a source with license, terms, attribution, automation permission, refresh cadence, and raw-storage policy.
2. Run a dry fetch and record terms/robots fingerprints and HTTP metadata.
3. Store licensed raw input as an immutable private snapshot; otherwise store only permitted metadata.
4. Normalize to canonical identities and deterministic candidate changes.
5. Validate schema, hierarchy, coordinates, tags, source references, freshness, and conflicting values.
6. Put every change into an admin review queue. Accepted candidates still do not alter the published pack.
7. Build a deterministic staged artifact with source/run IDs and checksums.
8. Run dataset tests, planning benchmarks, factual-support checks, and a canary preview.
9. Publish one immutable dataset version atomically; keep the prior version available for immediate rollback.

### Recommended sources

- **Canonical identity:** Wikidata (CC0) and GeoNames (CC BY 4.0).
- **Geography and routing substrate:** OpenStreetMap/Geofabrik under ODbL, with attribution and share-alike handling designed explicitly.
- **Popularity signals:** Wikimedia pageview analytics (CC0) as one signal, never the only quality score.
- **Official destination facts:** national/local tourism and open-government portals on a per-dataset license review.
- **Weather and climate:** official meteorological products where reuse is permitted; volatile forecast data should remain runtime data.
- **Standards and machine-readable identifiers:** IANA and other public-domain/official registries.
- **Media:** Wikimedia Commons only per-file, preserving individual license and attribution.
- **Audience/editorial context:** reviewed local specialists, official organizations, and clearly labeled self-attested venue data.

Do not crawl Google Places/Maps, Tripadvisor, Booking, Airbnb, blogs, or social platforms into the knowledge corpus without an explicit license. They may be runtime integrations under their terms, but they are not default training or reusable dataset sources.

### Cadence

- identity and hierarchy: quarterly, plus targeted corrections
- OSM-derived geography/routing: monthly or regional diff cadence
- destination/editorial packs: quarterly, with annual deep review
- seasonal facts: before each relevant season
- opening hours, prices, advisories, exchange rates, weather, and availability: runtime or short-lived cache, not permanent facts
- license and terms review: at least annually and whenever a fingerprint changes
- freshness audit: weekly; ingestion dry-run monthly; country-pack publish only after reviewed changes exist

### Quality controls

- zero orphan entities, invalid coordinates, unknown tags, or unsupported IDs
- source coverage above 95% for surfaced factual claims
- no expired fact silently presented as current
- deterministic artifact and seed checksums
- review reasons and accepted values preserved immutably
- route feasibility and latency benchmarks on every pack
- version-level rollback without deleting knowledge or rewriting existing trips

## 10. Umbrella and child applications

The shared platform should own identity, accounts, canonical places, city knowledge, media, provenance, trip graphs, and publishing operations. Child apps should own specialist constraints and presentation.

### Camper planner

Additional inputs:

- vehicle type, height, width, length, gross/axle weight, trailer, propane/hazard constraints
- preferred daily distance/time, road/toll/ferry preferences
- campsite type, hookups, waste/water, electricity, pet and season requirements

Dedicated engine:

- commercial truck/camper routing provider or an OSM-based restriction-aware stack
- hard avoidance of incompatible roads, tunnels, bridges, and low-emission restrictions
- camping inventory and facilities with freshness/community confidence
- feasible daily legs, service stops, fuel/charging, and overnight alternatives

It can reuse TravelFlow cities, POIs, activities, food, weather context, traveler setup, and the map presentation contract.

### Cruise port-day planner

Additional inputs:

- cruise line, ship, sailing, cabin time zone, port schedule, gangway/all-aboard times
- excursion bookings, mobility, party size, risk tolerance, and ship-guaranteed preference

Dedicated engine:

- predefined sailing/port schedule ingestion with change alerts
- strict return-to-ship buffer and tender/immigration assumptions
- timed activity bundles by duration and price
- transport reliability, meeting point, cancellation, and fallback plan

It can reuse canonical ports/cities, neighborhoods, activities, dishes, pricing bands, audience context, and destination briefs. The central product difference is that return feasibility is a hard constraint, not a suggestion.

## 11. Recommended execution order

The admin review, deterministic artifact staging, atomic publish, and rollback foundation is complete.

1. Validate the Thailand deterministic fast path against the classic generator with the visible engine receipt and tester checklist.
2. Add constrained AI personalization that patches the selected canonical route without regenerating the entire trip.
3. Implement progressive traveler setup for family, group, accessibility, dietary, and audience context.
4. Add group preference negotiation and explainable route scoring.
5. Keep the Journey Lens/sidebar work paused until the trip workspace direction is approved from isolated concepts.
6. Add two or three deeper Thailand content verticals: neighborhoods, family supply, food, and seasonal alternatives.
7. Prove the country-pack factory with one structurally different second country.
8. Prototype camper and cruise as separate adapters/products after the core graph and publishing workflow are stable.
