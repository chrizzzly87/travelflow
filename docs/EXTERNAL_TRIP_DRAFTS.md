# External trip drafts (LLM / WebMCP / MCP)

Outside assistants (ChatGPT, Claude, Gemini, browser agents) can plan a trip
themselves and hand TravelFlow the finished itinerary. TravelFlow validates it,
stores it as a **draft**, and gives back a link. Anyone with the link can view
the draft; saving it into an account turns it into a normal trip.

**TravelFlow never calls a model for an external draft.** The assistant spends
its own tokens. Our cost is one validation pass and one database row.

## Why this shape

- The in-house generator already asks models for one strict JSON document,
  `travelflow_trip_plan_v3` (`shared/aiTripItinerarySchema.ts`), and already has
  a validator (`shared/aiTripItineraryPreparation.ts`) and a converter to a full
  `ITrip` (`buildTripFromModelData` in `netlify/edge-functions/ai-generate-worker.ts`).
  External drafts reuse all three. An external assistant writes the same JSON
  our own model writes, so every draft that validates renders like a generated
  trip: cities, stays, travel legs, activities, day trips, country info.
- `trips.owner_id` is required and RLS is owner-based. An anonymous POST from a
  chatbot has no user, so drafts live in their own table until someone saves
  one. Saving creates an ordinary `trips` row through the existing
  `upsert_trip` path, so trip limits, expiry and history apply unchanged.
- Draft links expire after 30 days. Unclaimed drafts are then purged lazily,
  so spam cannot pile up; claimed ones stay hidden for the admin numbers.

## Data model (`supabase/migrations/20261031120000_trip_drafts.sql`)

`public.trip_drafts`

| column | notes |
| --- | --- |
| `id text pk` | `drf_` + 24 random base62 characters. It is the capability in the share link. |
| `title`, `start_date`, `round_trip` | Denormalised for the admin list. |
| `data jsonb` | The built `ITrip` the viewer renders. |
| `source_payload jsonb` | The submitted `travelflow_trip_plan_v3` document, for debugging. |
| `source` | `mcp`, `webmcp`, `api` or `paste`. |
| `client_name`, `client_model` | Self-reported by the assistant ("chatgpt", "gpt-5"). Untrusted, display only. |
| `user_agent`, `ip_hash` | `ip_hash` is an HMAC of the caller IP, only for rate limits. |
| `status` | `draft` → `claimed`; `expired` after `expires_at`. |
| `view_count`, `last_viewed_at` | Bumped by the public read. |
| `claim_count`, `first_claimed_at`, `first_claimed_by`, `first_claimed_trip_id` | Conversion tracking. |
| `expires_at` | `created_at + 30 days`. The link stops working then, saved or not; saved trips are unaffected. |

`public.trip_draft_claims (draft_id, user_id, trip_id, claimed_at)`, unique per
`(draft_id, user_id)`. A shared draft link can be saved by several people; one
person saving twice gets their existing trip back instead of a duplicate.

Claimed trips carry `source_kind = 'external_draft'` and
`source_template_id = <draft id>`, so they show up in the admin trips list
under their own source filter with no change to `trips`.

### RPCs

| function | caller | purpose |
| --- | --- | --- |
| `create_trip_draft(...)` | service role (edge) | Insert with rate limits: 30 per IP hash per hour (callers without an IP share one bucket), 2 000 overall per day, serialised per caller with an advisory lock. Returns a status code instead of raising. Purges expired, unclaimed drafts. |
| `get_trip_draft(p_draft_id, p_track_view)` | service role (edge) | Public read; bumps `view_count`. |
| `get_my_trip_draft_claim(p_draft_id)` | authenticated | The caller's existing trip for this draft, if any. |
| `claim_trip_draft(p_draft_id, p_trip_id)` | authenticated, non-anonymous | Records the claim after the client saved the trip. Checks the trip is the caller's. |
| `admin_list_trip_drafts(...)`, `admin_get_trip_draft_stats(p_days)` | admins with `trips.read` | Admin overview. |

## Surfaces

### HTTP API (`netlify/edge-functions/trip-drafts.ts`)

| route | |
| --- | --- |
| `GET /api/trip-drafts/schema` | JSON Schema, rules and a worked example. Cached at the CDN. |
| `GET /api/trip-drafts/openapi.json` | OpenAPI 3.1 for ChatGPT GPT Actions and other tool runners. |
| `POST /api/trip-drafts/validate` | Dry run. Returns `{ ok, errors[] }`. Writes nothing. |
| `POST /api/trip-drafts` | Validate, build, store. Returns `{ draftId, url, expiresAt }`. |
| `GET /api/trip-drafts/{id}` | The stored draft (used by the viewer and by assistants checking status). |

Request body for create and validate:

```json
{
  "trip": { "tripTitle": "…", "countryInfo": {}, "cities": [], "travelSegments": [], "activities": [], "dayTrips": [] },
  "startDate": "2027-04-12",
  "roundTrip": false,
  "client": { "name": "chatgpt", "model": "gpt-5" }
}
```

Limits: 256 KB body, 40 stops, 300 activities, 60 day trips. `startDate`
defaults to 30 days from today.

### Remote MCP server (`netlify/edge-functions/mcp.ts`, `POST /api/mcp`)

Stateless MCP over Streamable HTTP (JSON responses, no SSE; legacy batches run
sequentially, at most 20 messages). Tools:
`get_trip_draft_schema`, `validate_trip_draft`, `create_trip_draft`,
`get_trip_draft`. Add it in ChatGPT developer mode, Claude custom connectors or
any MCP client as `https://travelflowapp.netlify.app/api/mcp` with no auth.

### WebMCP (in-page tools)

`app/webmcp/travelFlowWebMcpTools.ts` (loaded by `app/bootstrap/useWebMcpBootstrap.ts`) registers the same tools through
`document.modelContext.registerTool` (or `navigator.modelContext` on older
Chrome builds) after hydration. `create_trip_draft` also navigates to the new
draft. Nothing is registered when the API is missing.

### Discovery

- `public/llms.txt`: what TravelFlow is, its public pages, and how to create a
  draft (schema URL, API, MCP endpoint, paste fallback).
- `public/llms-full.txt`: the same plus field-by-field rules and a full example.
- Both are generated from `shared/llmsTxt.ts` with `pnpm llms:generate`;
  `tests/unit/llmsTxt.test.ts` fails when the committed files are stale.
- `robots.txt` allows `/llms*.txt`, the schema and the OpenAPI document.
- `<link rel="alternate" type="text/plain" href="/llms.txt">` in the document head.

### Paste fallback (`/import-trip`)

Plain ChatGPT cannot POST. The assistant prints the JSON; the traveller pastes it
on `/import-trip`, which validates and creates the draft (`source = 'paste'`).

### Viewer and claim (`/draft/$draftId`)

Renders the draft in the example-trip preview mode with a banner: "Plan from an
AI assistant — save it to your account to edit". Saving:

1. Not signed in, or a guest session → login modal, returning to
   `/draft/<id>?claim=1`, which resumes the save.
2. `get_my_trip_draft_claim` → existing trip? Open it.
3. `dbCanCreateTrip` → limit dialog if full.
4. Copy with a new id, `sourceKind: 'external_draft'`, `sourceTemplateId: draftId`;
   `dbUpsertTrip` + version "Data: Saved AI draft".
5. `claim_trip_draft(draftId, tripId)`; open the trip.

## Admin

`/admin/trip-drafts`: totals (created, claimed, conversion, views) for the date
range, breakdown by source and client, and a table of drafts with status,
client, views, claims and a link to the draft and the claimed trip. The admin
trips list filters claimed drafts by the `External Draft` source.

## Analytics

`trip_draft__open`, `trip_draft__banner--save`, `trip_draft__claim--success`,
`trip_draft__claim--login_required`, `trip_import__submit`.

## Cost and abuse guards

- No model call anywhere on this path. The in-house generator is not exposed
  through any of these tools, and `llms.txt` says so.
- Body size, item counts and string lengths are capped before validation.
- Per-IP-hash and global daily caps in `create_trip_draft`.
- Drafts are `noindex`, and `/draft/` is disallowed in `robots.txt`.
- Unclaimed drafts expire after 30 days.

## Rollout

1. Apply the migration (deploys never run migrations; see `docs/SUPABASE_RUNBOOK.md`).
   Until then the API answers `503 drafts_unavailable`.
2. Deploy. Check `GET /api/trip-drafts/schema`, then create a draft with `curl`.
3. Add the MCP endpoint to ChatGPT developer mode and ask for a trip.
