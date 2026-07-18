# Thailand fast-path testing

Status: feature-branch QA checkpoint

This checklist distinguishes the new Thailand planning foundation from the classic large-prompt generator. It is deliberately explicit about what is implemented and what remains open.

## What is implemented

| Capability | Current behavior |
| --- | --- |
| Structured retrieval/RAG foundation | Retrieves a bounded planning context from the active, versioned Thailand catalogue with a bundled fallback. It does not send the full country pack to an LLM. |
| Fast route comparison | Deterministically ranks up to three route templates from the compact context. The comparison itself makes zero AI calls. |
| Direct city coverage | All fifteen supported cities have a city-break concept in the twenty-seven-template v14 catalogue, including non-Bangkok routes for Chiang Rai, Krabi, Pai, Hua Hin, and the island bases. |
| Area choice coverage | Every supported city has at least two selectable neighborhoods or editorial travel areas. New area records state base fit, walkability, evening energy, tradeoffs, and their non-administrative scope. |
| Deeper selected route | Selecting a concept retrieves more neighborhoods and POIs, pinned to the chosen template and dataset version. |
| Editable base trip | Opens a canonical, knowledge-enriched trip immediately without waiting for OpenAI. |
| Constrained AI adaptation | After selecting a route, an optional free-text request proposes a small patch against known catalogue IDs. The base route remains locked until the traveler reviews and applies the proposal. |
| Rich activity contract | All forty-six Thailand POIs carry category-aware duration, best time, hours or operating context where applicable, admission, booking, weather/effort, access, facilities, audience fit, practical notes, freshness, and per-field provenance. Every supported city has at least three rich activity anchors; missing or inapplicable research stays visibly absent rather than being invented. |
| Admin catalogue | Shows the active dataset, searchable entities and templates, facts, tags, freshness, scores, source links, rich/usable/starter coverage, a one-click enrichment queue, coverage-priority sorting, missing fields, and the separate ingestion review queue. |
| Visual proof | The route reveal reports retrieval time, payload size, selected/source entity and template counts, source, dataset/retriever version, and `0 AI calls`. The trip trace preserves the same receipt. |

## What is not implemented yet

| Capability | Next change |
| --- | --- |
| Free-text semantic/vector retrieval | Add embeddings only for free-text wishes and long-tail notes; keep geography, dates, duration, freshness, and traveler constraints as structured filters. |
| Long-tail Thailand activity depth | Expand beyond the current forty-six researched POIs and add restaurants, dishes, recurring events, lodging context, and more day-trip candidates while preserving the same evidence contract. |
| Full traveler setup | Add party composition, child ages, mobility, dietary needs, LGBTQ+ context preferences, and group hard constraints/votes to `JourneySpec` and ranking. |
| Live operational data | Keep weather, closures, schedules, real-time availability, and volatile prices in licensed runtime providers or short-lived caches. |
| New trip-page sidebar | Paused. Review isolated layout concepts before changing the production workspace again. |

## Test the fast path

1. Open the named feature preview and go to `/create-trip`. The branch is configured to use the structured Thailand planner on the primary creator URL; production remains unchanged.
2. Choose **City break**, select **Bangkok**, **Chiang Rai**, **Ayutthaya**, **Sukhothai**, **Kanchanaburi**, **Pattaya**, **Hua Hin**, **Pai**, or **Krabi**, set a suitable duration, then choose a pace and interests.
3. Select **Compare plans**.
4. In **Source-backed fast path**, verify that the receipt visibly shows:
   - `0 AI calls`
   - the active `2026.07.18-v14` dataset
   - a structured retriever version
   - retrieval time and a bounded payload size
   - selected places/templates versus source totals
5. Choose one of the returned routes. Wait for the deeper selected-context line to report neighborhoods, activities, and payload size. Chiang Rai should offer **Chiang Rai in three colors** and the **City Centre / Clock Tower** plus **Rim Kok Riverside** areas; Krabi should offer **Krabi between cliffs and sea**.
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
3. Confirm the coverage summary reports **46 Activity POIs**, **46 Rich**, **0 Usable**, **0 Starter**, and **99% Average coverage**.
4. Confirm there is no zero-count enrichment-queue action. Optional gaps can remain visible for honest inapplicable or unpublished fields, such as exact public-access hours for an active railway bridge.
5. Filter activity coverage to **Rich**, then inspect `Grand Palace`, `Mu Ko Lanta National Park`, `Tiger Cave Temple`, `Wat Chalong`, `Hua Hin Night Market`, `Sairee Beach sunset`, `Baan Dam Museum`, and `Tha Phae Gate and Walking Street`.
6. Verify facts show values, confidence/review state, observation and validity dates, source keys, and source links. The activity catalogue should expose category-relevant hours or operating context, pricing, weather, physical effort, access, facilities, and family/mobility fit; v14 should list 46 activities, 27 templates, and 45 neighborhoods.
7. Confirm volatile values display check-before-visit guidance and that the Sunday Walking Street schedule is not presented as the daily opening time of Tha Phae Gate.
8. Search/filter other entity types and inspect a route template with its stops and legs.
9. Open **Review queue** and confirm the existing candidate workflow is still separate and functional.

## Report useful QA evidence

For each path, record the URL, trip shape, selected city, duration, receipt values, time to editable trip, dataset version, and any missing or misleading activity field. For failures, include the trip URL and whether the failure occurred before the receipt, during selected-context loading, while opening the base, or only in classic OpenAI generation.
