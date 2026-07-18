# Thailand fast-path testing

Status: feature-branch QA checkpoint

This checklist distinguishes the new Thailand planning foundation from the classic large-prompt generator. It is deliberately explicit about what is implemented and what remains open.

## What is implemented

| Capability | Current behavior |
| --- | --- |
| Structured retrieval/RAG foundation | Retrieves a bounded planning context from the active, versioned Thailand catalogue with a bundled fallback. It does not send the full country pack to an LLM. |
| Fast route comparison | Deterministically ranks up to three route templates from the compact context. The comparison itself makes zero AI calls. |
| Deeper selected route | Selecting a concept retrieves more neighborhoods and POIs, pinned to the chosen template and dataset version. |
| Editable base trip | Opens a canonical, knowledge-enriched trip immediately without waiting for OpenAI. |
| Constrained AI adaptation | After selecting a route, an optional free-text request proposes a small patch against known catalogue IDs. The base route remains locked until the traveler reviews and applies the proposal. |
| Rich activity contract | Twenty-two researched anchor POIs carry category-aware duration, best time, hours, admission, booking, weather/effort, access, facilities, audience fit, practical notes, freshness, and per-field provenance. Missing research stays visibly absent rather than being invented. |
| Admin catalogue | Shows the active dataset, searchable entities and templates, facts, tags, freshness, scores, source links, rich/usable/starter coverage, a one-click enrichment queue, coverage-priority sorting, missing fields, and the separate ingestion review queue. |
| Visual proof | The route reveal reports retrieval time, payload size, selected/source entity and template counts, source, dataset/retriever version, and `0 AI calls`. The trip trace preserves the same receipt. |

## What is not implemented yet

| Capability | Next change |
| --- | --- |
| Free-text semantic/vector retrieval | Add embeddings only for free-text wishes and long-tail notes; keep geography, dates, duration, freshness, and traveler constraints as structured filters. |
| Complete Thailand activity depth | Expand the rich activity contract beyond the twenty-two researched anchors. The other 10 POIs are deliberately marked `starter` with category-specific missing-field lists. |
| Full traveler setup | Add party composition, child ages, mobility, dietary needs, LGBTQ+ context preferences, and group hard constraints/votes to `JourneySpec` and ranking. |
| Live operational data | Keep weather, closures, schedules, real-time availability, and volatile prices in licensed runtime providers or short-lived caches. |
| New trip-page sidebar | Paused. Review isolated layout concepts before changing the production workspace again. |

## Test the fast path

1. Open the named feature preview and go to `/create-trip`. The branch is configured to use the structured Thailand planner on the primary creator URL; production remains unchanged.
2. Choose **City break**, select **Bangkok**, set four days, then choose a pace and interests.
3. Select **Compare plans**.
4. In **Source-backed fast path**, verify that the receipt visibly shows:
   - `0 AI calls`
   - the active `2026.07.18-v10` dataset
   - a structured retriever version
   - retrieval time and a bounded payload size
   - selected places/templates versus source totals
5. Choose the Bangkok route. Wait for the deeper selected-context line to report neighborhoods, activities, and payload size.
6. Before using AI, select **Open instant base** if you want to prove the zero-AI path. The editable trip should open without an AI-generation waiting screen.
7. Return to the route reveal and enter a request such as: “Make this slower, prioritize food, keep the Grand Palace, and avoid crowded markets.”
8. Select **Adapt this route**. Verify that the review card visibly reports `1 AI call`, the server-selected model, response time, and the same dataset version.
9. Confirm that the suggested changes use named catalogue places, do not add a new base city, and separate unsupported requests or cautions from applied changes.
10. Select **Apply changes**, then **Undo**. The route and duration must stay unchanged in both states.
11. Apply again and select **Open adapted trip**. Confirm that the trip trace reports one AI call and that avoided catalogue activities are absent while requested known activities remain available.
12. Confirm that Bangkok and its activities are editable and that the trip does not show the experimental Journey Lens/sidebar.
13. Open **Grand Palace** in the timeline. Its activity drawer should show **Source-backed visitor details** with duration, hours, admission, booking, family fit, dress guidance, freshness, and source links above the normal activity controls.

The AI adaptation is not a second full itinerary generation. It receives only the selected `JourneySpec` and a bounded catalogue context, returns an allowlisted patch, and is validated on the server and in the browser before it can affect the trip.

## Compare it with classic generation

1. Follow **Planning somewhere else? Use the classic creator**, or open `/create-trip/labs/classic-card` in a second tab.
2. Enter an equivalent Bangkok trip and start classic generation.
3. Compare:
   - time until the first useful editable route
   - time for the optional one-call adaptation after the route already exists
   - whether OpenAI quota or generation latency blocks the result
   - route consistency across repeated equivalent inputs
   - source/freshness visibility
   - depth and structure of activity metadata

The comparison is intentionally not claimed as a production speed multiplier yet. The local deterministic compiler is below 0.4 ms p95, but end-user timing also includes Supabase/network latency, rendering, persistence, and the optional adaptation request. Capture those browser timings during preview QA before publishing a user-facing performance claim.

## Test the admin catalogue

1. Sign in with an admin account and open `/admin/travel-knowledge`.
2. Confirm the page opens on **Published catalogue**, not the review queue.
3. Confirm the coverage summary reports **32 Activity POIs**, **22 Rich**, **0 Usable**, **10 Starter**, and **73% Average coverage**.
4. Select **Open enrichment queue (10)**. Confirm the POI filter changes to **Needs work** and sorting changes to **Coverage priority**.
5. Confirm `Mu Ko Lanta National Park` appears before the higher-coverage starter entries and that each card lists its required and recommended gaps.
6. Filter activity coverage to **Rich**, then inspect `Grand Palace`, `Ayutthaya Historical Park`, `Pai Canyon`, `Ko Nang Yuan`, `Emerald Pool / Sa Morakot`, and `Ko Hong`.
7. Verify facts show values, confidence/review state, observation and validity dates, source keys, and source links. The four v10 additions should expose category-relevant fields such as weather, physical effort, access, facilities, and family/mobility fit.
8. Search/filter other entity types and inspect a route template with its stops and legs.
9. Open **Review queue** and confirm the existing candidate workflow is still separate and functional.

## Report useful QA evidence

For each path, record the URL, trip shape, selected city, duration, receipt values, time to editable trip, dataset version, and any missing or misleading activity field. For failures, include the trip URL and whether the failure occurred before the receipt, during selected-context loading, while opening the base, or only in classic OpenAI generation.
