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
| Rich activity contract | Researched Bangkok POIs can carry duration, best time, hours, admission, booking, dress, accessibility, audience fit, practical notes, freshness, and per-field provenance. Missing research stays visibly absent rather than being invented. |
| Admin catalogue | Shows the active dataset, searchable entities and templates, facts, tags, freshness, scores, source links, and the separate ingestion review queue. |
| Visual proof | The route reveal reports retrieval time, payload size, selected/source entity and template counts, source, dataset/retriever version, and `0 AI calls`. The trip trace preserves the same receipt. |

## What is not implemented yet

| Capability | Next change |
| --- | --- |
| AI personalization of the selected base | Add a constrained patch request that can change pace, candidates, ordering, and explanations only through known canonical IDs, followed by validation. It must not replace the trip with one large generated JSON object. |
| Free-text semantic/vector retrieval | Add embeddings only for free-text wishes and long-tail notes; keep geography, dates, duration, freshness, and traveler constraints as structured filters. |
| Complete Thailand activity depth | Expand the rich activity contract beyond the four Bangkok proof points, prioritizing every POI used by the top templates. |
| Full traveler setup | Add party composition, child ages, mobility, dietary needs, LGBTQ+ context preferences, and group hard constraints/votes to `JourneySpec` and ranking. |
| Live operational data | Keep weather, closures, schedules, real-time availability, and volatile prices in licensed runtime providers or short-lived caches. |
| New trip-page sidebar | Paused. Review isolated layout concepts before changing the production workspace again. |

## Test the fast path

1. Open the named feature preview and go to `/create-trip/wizard`.
2. Choose **City break**, select **Bangkok**, set four days, then choose a pace and interests.
3. Select **Compare plans**.
4. In **Source-backed fast path**, verify that the receipt visibly shows:
   - `0 AI calls`
   - the active `2026.07.17-v6` dataset
   - a structured retriever version
   - retrieval time and a bounded payload size
   - selected places/templates versus source totals
5. Choose the Bangkok route. Wait for the deeper selected-context line to report neighborhoods, activities, and payload size.
6. Select **Open instant base**. The editable trip should open without an AI-generation waiting screen.
7. Confirm that Bangkok and its activities are editable and that the trip does not show the experimental Journey Lens/sidebar.
8. Open **Grand Palace** in the timeline. Its activity drawer should show **Source-backed visitor details** with duration, hours, admission, booking, family fit, dress guidance, freshness, and source links above the normal activity controls.

## Compare it with classic generation

1. In a second tab, open `/create-trip`.
2. Enter an equivalent Bangkok trip and start classic generation.
3. Compare:
   - time until the first useful editable route
   - whether OpenAI quota or generation latency blocks the result
   - route consistency across repeated equivalent inputs
   - source/freshness visibility
   - depth and structure of activity metadata

The comparison is intentionally not claimed as a production speed multiplier yet. The local deterministic compiler is below 0.4 ms p95, but end-user timing also includes Supabase/network latency, rendering, and persistence. Capture those browser timings during preview QA before publishing a user-facing performance claim.

## Test the admin catalogue

1. Sign in with an admin account and open `/admin/travel-knowledge`.
2. Confirm the page opens on **Published catalogue**, not the review queue.
3. Search for `Grand Palace` and expand it.
4. Verify facts show values, confidence/review state, observation and validity dates, source keys, and source links.
5. Search/filter other entity types and inspect a route template with its stops and legs.
6. Open **Review queue** and confirm the existing candidate workflow is still separate and functional.

## Report useful QA evidence

For each path, record the URL, trip shape, selected city, duration, receipt values, time to editable trip, dataset version, and any missing or misleading activity field. For failures, include the trip URL and whether the failure occurred before the receipt, during selected-context loading, while opening the base, or only in classic OpenAI generation.
