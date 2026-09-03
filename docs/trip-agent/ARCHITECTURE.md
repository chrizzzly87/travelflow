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

The allowlist lives in `trip_agent_definitions.tool_allowlist`; anything outside
it is dropped before the run starts.

### Specialists (read-only, via MCP)

`trip-agent-maps-mcp.ts` opens an HTTP MCP client against
`https://mapstools.googleapis.com/mcp`, authenticated with
`GOOGLE_MAPS_GROUNDING_API_KEY` or, when that is unset, the existing
`VITE_GOOGLE_MAPS_API_KEY`.

That server exposes `search_places`, `compute_routes`, `resolve_names`,
`resolve_maps_urls` and `lookup_weather`. Each specialist sees only its own
capability:

- `hotel_scout` — `search_places`, `resolve_names`, `resolve_maps_urls`
- `route_planner` — `compute_routes`, `resolve_names`

With no usable key both return `status: "unavailable"` and say so in the chat;
they never invent place or route facts. Neither specialist can touch the trip.

A dedicated server-side key is still preferable: the browser key is meant to be
referrer-restricted, and a restriction that blocks server calls turns grounding
off silently (the chip will say `Unavailable`).

## Trip changes

The model emits **flat wire operations** (`shared/tripAgentWireOperations.ts`):
one object with an enum `kind` plus the fields that kind needs. Function-calling
models cannot reliably produce the ten-variant discriminated union used
internally, so the server converts and validates instead, answering with the
exact missing field when something is wrong.

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

Nothing is written by the run itself. The panel shows the proposal, the reviewer
picks operations, previews the resulting trip (computed client-side with
`applyTripAgentOperations`), and only then `apply` runs
`apply_trip_agent_change_set` — one atomic Supabase version that the client
adopts as a single undo/redo entry. Stale proposals (the trip moved on) fail
with `TRIP_AGENT_PROPOSAL_STALE`.

## Persistence and limits

Tables: `trip_agent_threads`, `trip_agent_messages`, `trip_agent_runs`,
`trip_agent_tool_calls`, `trip_agent_change_sets`, `trip_agent_usage_daily`,
`trip_agent_prompt_versions`, `trip_agent_definitions`. RLS allows reads for trip
collaborators; all mutations go through the service role.

Free accounts get three requests per UTC day, reserved before model access and
refunded when a run fails before producing anything.

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
