# Trip Agent architecture

How the planner chat runs, what the agents may call, and which changes they can
propose. Companion to `docs/trip-agent/TODO.md` (delivery state) and
`docs/AI_BACKEND_TARGET_ARCHITECTURE.md` (wider AI backend).

## Request path

```
TripAgentPanel (React, lazy)
  → services/tripAgentService.ts        Supabase access token, error mapping
  → POST /api/trip-agent                netlify/functions/trip-agent.ts
  → netlify/edge-lib/trip-agent-handler.ts
        authenticate → entitlement → quota reservation → persist user message
  → netlify/edge-lib/trip-agent-runtime.ts
        ToolLoopAgent (AI SDK 7) → UI message stream back to the panel
  → netlify/edge-lib/trip-agent-store.ts  PostgREST with the service role
```

The route is a **Netlify serverless function**, not an edge function: AI SDK 7
pulls Node/OIDC dependencies that the Deno edge runtime cannot load. Every other
`/api/*` route stays on edge.

### Handler actions (`POST /api/trip-agent`)

| action | what it does |
| --- | --- |
| `GET ?tripId=&threadId=` | bootstrap: actor, threads, current transcript, quota |
| `createThread` | opens a chat for the trip |
| `archiveThread` | archives one chat |
| `chat` | reserves quota, stores the user message, streams a run |
| `apply` | applies selected operations atomically as one trip version |
| `reject` | marks a proposal rejected |

Failures are classified into named codes (`TRIP_AGENT_PERSISTENCE_FAILED`,
`TRIP_AGENT_MODEL_NOT_CONFIGURED`, `TRIP_AGENT_QUOTA_EXCEEDED`, …) with a bounded
detail and the request id, which the panel renders inside the conversation.

## Model selection

`netlify/edge-lib/trip-agent-model.ts` resolves one model for the orchestrator
and the specialists:

1. `TRIP_AGENT_MODEL` (e.g. `openrouter:google/gemini-3.8-flash`)
2. `ai_default_model_id` from `get_public_runtime_settings` — the app-wide
   default, so the planner follows the admin setting
3. the `trip_agent_definitions` row (`model`, then `fallback_model`)

Providers: AI Gateway (`AI_GATEWAY_API_KEY`), OpenRouter (`OPENROUTER_API_KEY`,
OpenAI-compatible), or OpenAI direct (`OPENAI_API_KEY`). OpenRouter calls carry
a `reasoning` body field (`TRIP_AGENT_REASONING_EFFORT`, default `low`);
without it a thinking model spends the whole output budget before it can emit a
tool call. Output budget is 12k tokens, the loop stops after 8 steps.

## Agent functions

### Orchestrator (`trip_orchestrator`)

| tool | purpose | writes? |
| --- | --- | --- |
| `read_trip_context` | canonical trip plus the `@` context attached to the message | no |
| `delegate_hotel_search` | hands a stay question to the hotel specialist | no |
| `delegate_route_planning` | hands a route question to the route specialist | no |
| `create_trip_proposal` | records a pending, reviewable change set | proposal only |
| `ask_traveler` | asks one multiple-choice question, e.g. what to do with days a change frees up | no |

The allowlist lives in `trip_agent_definitions.tool_allowlist`; anything outside
it is dropped before the run starts. `ask_traveler` is always active, since the
stored allowlists predate it.

Only one proposal is open per trip: creating a change set closes any pending one
(`rejected`), and the panel marks the older card as replaced. A follow-up answer
must arrive as a single new proposal, not a second competing one.

### Specialists (read-only, via MCP)

`trip-agent-maps-mcp.ts` opens an HTTP MCP client against
`https://mapstools.googleapis.com/mcp`, authenticated with
`GOOGLE_MAPS_GROUNDING_API_KEY` when set, otherwise the existing
`VITE_GOOGLE_MAPS_API_KEY` (owner decision, 2026-09-04; the run logs which
source it used). A shared browser key must be quota-capped and API-restricted in
Google Cloud, because it is readable in the client bundle.

That server exposes `search_places`, `compute_routes`, `resolve_names`,
`resolve_maps_urls` and `lookup_weather`. Each specialist sees only its own
capability:

- `hotel_scout` — `search_places`, `resolve_names`, `resolve_maps_urls`
- `route_planner` — `compute_routes`, `resolve_names`

With no usable key both return `status: "unavailable"` and say so in the chat;
they never invent place or route facts. Neither specialist can touch the trip.

A referrer restriction that blocks server calls turns grounding off silently —
the step chip will read `Unavailable` rather than failing loudly.

## Trip changes

The model emits **flat wire operations** (`shared/tripAgentWireOperations.ts`):
one object with an enum `kind` plus the fields that kind needs. Function-calling
models cannot reliably produce the ten-variant discriminated union used
internally, so the server converts and validates instead, answering with the
exact missing field when something is wrong.

The wire schema is deliberately forgiving — unknown keys are dropped, numeric
strings are coerced, an unsupported transport mode becomes `na` — because the AI
SDK rejects a call that fails the schema *before* the tool runs, which surfaced
in the chat as an unexplained failed step. Genuine mistakes still come back as a
fixable answer from inside the tool.

| kind | required fields | effect |
| --- | --- | --- |
| `add_item` | `item` | adds a city, activity or transfer |
| `update_item` | `itemId`, `itemChanges` | edits title, description, duration, transport, … |
| `move_item` | `itemId`, `startDateOffset` | moves an item to another day |
| `remove_item` | `itemId` | removes an item |
| `add_stay` | `cityId`, `stay` | adds a stay to a city |
| `update_stay` | `cityId`, `stayId`, `stayChanges` | edits a stay |
| `remove_stay` | `cityId`, `stayId` | removes a stay |
| `replace_itinerary` | `items` | replaces the whole timeline |
| `replace_itinerary_segment` | `startOffset`, `endOffset`, `items` | replaces a stretch of days |
| `update_trip` | `tripChanges` | title, start date, round trip |

`startDateOffset` counts days from the trip start and begins at 0.

### Approval path

Nothing is written by the run itself. The panel groups the operations per stop,
the reviewer picks what to apply, previews the result **in the planner itself**
(calendar, timeline and map render the proposed trip; editing is paused and the
saved timestamp is preserved so nothing downstream treats it as a new version),
and only then `apply` runs `apply_trip_agent_change_set` — one atomic Supabase
version that the client adopts as a single undo/redo entry. Stale proposals (the
trip moved on) fail with `TRIP_AGENT_PROPOSAL_STALE`.

`applyTripAgentOperations` never fails a whole set over one unusable operation:
a missing target is skipped and reported (`skippedOperations`), so a deselected
dependency or an id the trip no longer has cannot sink the review. Only
structural faults — duplicate operation ids, an unknown selection, a result that
fails validation — throw. The card reports a partial apply rather than letting a
previewed change disappear.

## Persistence and limits

Tables: `trip_agent_threads`, `trip_agent_messages`, `trip_agent_runs`,
`trip_agent_tool_calls`, `trip_agent_change_sets`, `trip_agent_usage_daily`,
`trip_agent_prompt_versions`, `trip_agent_definitions`. RLS allows reads for trip
collaborators; all mutations go through the service role.

Free accounts get three requests per UTC day, reserved before model access and
refunded when a run fails before producing anything. Answering a question the
agent itself asked (`ask_traveler`) is a free continuation: the server checks
whether the newest assistant message carries an open question and skips the
reservation, so an ask-first flow does not cost two runs. The refund RPC only
credits a ledger row it actually charged, so a free continuation cannot refund
anything.

Creating a proposal supersedes any pending proposal **in the same thread**, not
across the trip: a collaborator's open review in another chat is left alone.

A revert restores the pre-apply trip as a new version *and* marks the change set
`reverted`. The change set keeps `applied_version_id`, so a redo works after a
reload even when the browser no longer holds the applied snapshot.

## Privacy and secrets

The invariants below, and the review findings that produced them, are written up
in [`docs/AI_AGENT_FEATURE_GUARDRAILS.md`](../AI_AGENT_FEATURE_GUARDRAILS.md).


Hidden reasoning is never streamed (`sendReasoning: false`), never stored
(stripped before persistence and again on read) and never rendered; the public
plan the model writes as text is the only account of its thinking.

Every diagnostic string — log line, run record, client payload — passes through
`trip-agent-redaction.ts`, which strips keys, bearer tokens, JWTs, URLs and long
opaque blobs and bounds the length. The browser receives a code and an authored
sentence only; the redacted diagnostic stays in the server log beside the
request id.

On the OpenRouter path the request denies provider data collection and provider
fallbacks, and the configured default model must appear in the administrator's
approved list or it is not used. The Gateway path carries the same guarantee
through `zeroDataRetention`.

## Runtime limits

Netlify terminates a synchronous function at 60 seconds, outside this code's
error handling, so an interactive run is budgeted at 45 seconds
(`INTERACTIVE_RUN_BUDGET_MS`) and always closes its own run record. Bootstrap
additionally closes messages and runs left behind by a terminated function.

## Observability

Bounded structured logs, no prompts or credentials:
`[trip-agent] chat accepted | user message persistence failed | proposal created
| proposal rejected as invalid | run finished | stream failed`, each carrying
trip, thread, request and run ids plus the model and latency. Read them with
`netlify logs:function trip-agent` (production) or the deploy log for a preview.

## Local verification

`pnpm trip-agent:dry-run <tripId> "<prompt>"` replays one turn against a real
trip using the service role: same instructions, tools and validation, with
persistence and quota stubbed. It prints the plan, every tool call, the proposed
operations and the resulting itinerary — the fastest way to tell a model problem
from a product problem.
