# AI Backend Target Architecture (Provider-Agnostic + Benchmark Workspace)

Status: Draft for implementation planning  
Owner: TravelFlow engineering  
Last updated: 2026-02-11

Current implementation status:
1. `/api/ai/generate` is implemented for Gemini, OpenAI, and Anthropic allowlisted models.
2. OpenRouter backend adapter is intentionally not enabled yet.
3. `/api/internal/ai/benchmark` is implemented with Supabase-backed session/run persistence and real provider execution.
4. `/api/internal/ai/benchmark/export` is implemented (`run` JSON export, `session` ZIP export, optional log bundle via `includeLogs=1`).
5. `/api/internal/ai/benchmark/cleanup` is implemented for bulk deletion of benchmark-linked trips and benchmark rows.
6. `/api/internal/ai/benchmark/rating` is implemented for persisted per-run satisfaction ranking updates (`good`, `medium`, `bad`).
7. `/admin/ai-benchmark` now includes classic benchmark input, prompt preview generation, dynamic model matrix, rerun/test-all, persisted table, export/cleanup actions, persisted ranking controls, and model-level summary cards.
8. Benchmark model-row selections in admin UI are persisted locally with default starter set (Gemini 3 Pro, Gemini 3 Flash, GPT-5.2, Claude Sonnet 4.5).
9. Benchmark table uses optimistic prefilled running rows with live latency feedback during test execution.
10. Transport mode enum + normalization + prompt guidance now use a shared contract (`shared/transportModes.ts`) with update workflow documented in `docs/TRANSPORT_MODE_CONTRACT.md`.
11. Benchmark validation now includes stricter field/format checks with blocking errors vs non-blocking warning separation and per-run validation detail modal support in `/admin/ai-benchmark`.
12. Benchmark execution now starts asynchronously in edge background (`waitUntil`) and `/admin/ai-benchmark` polls session status until runs settle, reducing deployed timeout failures.

## 1) Confirmed decisions (2026-02-11)

1. Internal benchmark route will be `/admin/ai-benchmark`.
2. Debug toolbar must include a direct action to open `/admin/ai-benchmark`.
3. Main `/create-trip` form gets a provider/model selector before submit.
4. Selector default is Gemini and is visible only when simulated login is enabled for now.
5. Trip generation provider keys are server-managed only.
6. Initial provider families: Google/Gemini, OpenAI, Anthropic, plus curated free model entries where useful.
7. Benchmark runs must create real trips (for visual QA in normal trip UI).
8. Benchmark output export must support per-row JSON and full session ZIP download.
9. No benchmark-specific share logic changes; benchmark trips are flagged for later bulk removal.
10. Cleanup is explicit bulk removal by benchmark marker. No auto-archive policy for now.
11. Benchmark page v1 uses Classic flow only.
12. Test-all should run all selected targets and allow rerun of single failed rows.
13. Every generated trip should store model metadata, with low-visibility display in trip info UI.
14. Benchmark results must be persisted in dedicated benchmark tables.

## 2) Goals

1. Decouple trip generation from Gemini-specific SDK calls.
2. Keep one canonical output contract (`ITrip`) regardless of provider/model.
3. Move model calls server-side (no browser-exposed provider API keys).
4. Add an internal benchmark workspace that compares multiple providers/models using the same Classic create-trip input.
5. Persist benchmark sessions/runs so results survive reload and can be shared by URL.
6. Mark benchmark-created trips in a future-proof way for reliable bulk cleanup.

## 3) Non-goals (initial rollout)

1. Perfect deterministic parity between providers.
2. Full Wizard/Surprise support in benchmark v1.
3. Public exposure of benchmark tooling.
4. Login/register implementation in this phase (static admin header is temporary).

## 4) Current baseline in this repo

1. Generation is centralized in `services/aiService.ts` and directly called by UI.
2. `services/geminiService.ts` is now a backward-compatibility re-export shim to avoid breaking older imports during migration.
3. Prompt shaping + schema + normalization already exist and must remain canonical.
4. Browser currently reads `VITE_GEMINI_API_KEY` and calls provider from client code.
5. Netlify Edge Functions are already configured via `netlify.toml` and can host internal API routes.
6. Supabase already stores trips with useful source metadata fields (`source_kind`, `source_template_id`).

## 5) Target architecture overview

```text
CreateTrip UI (classic)                Admin AI Benchmark UI
- optional provider select             - classic form on left
- visible in sim-login mode            - model matrix on right
                 |                                   |
                 +----------- POST /api/ai/generate -+
                                 POST /api/internal/ai/benchmark
                                                 |
                                                 v
                                    AI Orchestrator (provider-agnostic)
                                    - prompt builder (classic only in v1 benchmark)
                                    - adapter dispatch
                                    - schema/rule validation
                                    - canonical normalization to ITrip
                                                 |
                                                 v
                                         Provider adapters
                                    - GeminiAdapter
                                    - OpenAIAdapter
                                    - AnthropicAdapter
                                    - OpenRouterAdapter (for curated free extras)
                                                 |
                                                 v
                                              Supabase
                                    - trips (real saved outputs)
                                    - ai_benchmark_sessions
                                    - ai_benchmark_runs
```

## 6) Provider and model strategy

## 6.1 Curated catalog only (no full provider model dump)

Use a repo-owned curated list in `config/aiModelCatalog.ts`.

Each entry includes:
1. `provider`
2. `model`
3. `label`
4. `group`
5. `isFreeTierCandidate`
6. `releasedAt`
7. `enabled`
8. `visibleInCreateTrip`
9. `visibleInBenchmark`

This supports phased exposure and future tester-role gating without UI rewrites.

## 6.2 Initial provider families

1. `gemini` (default in create form)
2. `openai`
3. `anthropic`
4. `openrouter` (only for selected free/experimental entries)

## 6.2.1 Curated model allowlist (v1)

Google Gemini:
1. `gemini-2.5-flash`
2. `gemini-2.5-pro`
3. `gemini-3-flash-preview`
4. `gemini-3-pro-preview` (current runtime default)

OpenAI:
1. `gpt-5-mini`
2. `gpt-5.2`

Anthropic:
1. `claude-sonnet-4.5`
2. `claude-opus-4.6`

## 6.3 Why OpenRouter in addition to direct providers

1. Fast access to curated free/low-cost multi-vendor models through one adapter.
2. Useful for benchmark breadth without adding many SDK integrations.
3. Direct provider adapters (OpenAI/Anthropic/Gemini) remain primary path for stable production behavior.

## 7) Core module boundaries and interfaces

## 7.1 New modules

1. `services/ai/contracts.ts`
2. `services/ai/promptBuilders.ts`
3. `services/ai/validators.ts`
4. `services/ai/orchestrator.ts`
5. `services/ai/providers/geminiAdapter.ts`
6. `services/ai/providers/openaiAdapter.ts`
7. `services/ai/providers/anthropicAdapter.ts`
8. `services/ai/providers/openRouterAdapter.ts`
9. `services/ai/providers/providerRegistry.ts`
10. `config/aiModelCatalog.ts`

## 7.2 Type contracts (proposed)

```ts
export type AiProviderId = 'gemini' | 'openai' | 'anthropic' | 'openrouter';
export type GenerationFlow = 'classic' | 'wizard' | 'surprise';

export interface AiModelRef {
  provider: AiProviderId;
  model: string;
  label?: string;
}

export interface TripGenerationScenario {
  flow: GenerationFlow;
  startDate?: string;
  input: Record<string, unknown>;
}

export interface AiUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  raw?: Record<string, unknown>;
}

export interface TripValidationResult {
  schemaValid: boolean;
  checks: {
    cityCountValid: boolean;
    activityTypesValid: boolean;
    cityIndexValid: boolean;
    markdownSectionsValid: boolean;
    travelSegmentIndicesValid: boolean;
  };
  errors: string[];
}

export interface TripAiMeta {
  provider: AiProviderId;
  model: string;
  gateway?: 'direct' | 'openrouter';
  generatedAt: string;
  benchmarkSessionId?: string | null;
  benchmarkRunId?: string | null;
}
```

## 7.3 Canonical behavior rules

1. Preserve existing prompt semantics from `services/aiService.ts`.
2. Preserve canonical transform logic (`buildTripFromModelData`) as final shaping layer.
3. Validate and normalize in one central path, never duplicated per provider.
4. Keep provider-specific parsing/retry logic inside adapters.

## 8) API surface (server-side)

## 8.1 Runtime generation endpoint

`POST /api/ai/generate`

Purpose:
1. Main create-trip generation path.
2. Accept optional selected provider/model from UI.
3. Enforce allowlist from model catalog.

Notes:
1. Default target is Gemini when selector is absent.
2. Selector may be hidden for non-sim-login users but endpoint still validates input strictly.

## 8.2 Internal benchmark endpoint

`POST /api/internal/ai/benchmark`

Purpose:
1. Run one Classic scenario against one or many selected targets.
2. Persist each run row and generated trip.
3. Support rerun for single target row.

Request fields:
1. `sessionId` optional
2. `sessionName` optional
3. `scenario` (Classic-only in v1)
4. `targets[]`
5. `runCount`
6. `concurrency` optional (server-capped)

Response includes:
1. session metadata
2. run rows with status/latency/validation/usage/cost/trip URL
3. summary counts
4. persisted session token for URL reload/share

## 8.3 Benchmark read endpoint

`GET /api/internal/ai/benchmark?session=<id-or-token>`

Returns full session config + all persisted run rows for reload/share.

## 8.4 Export endpoints

1. `GET /api/internal/ai/benchmark/export?run=<runId>&format=json`
2. `GET /api/internal/ai/benchmark/export?session=<sessionId>&format=zip`

Behavior:
1. Per-row export downloads normalized trip JSON + metadata.
2. Session ZIP contains one JSON file per run, named by provider/model/run index.
3. Optional log bundle (`includeLogs=1`) adds scenario JSON, prompt text, NDJSON logs, and per-run log files.

## 8.5 Cleanup endpoint

`POST /api/internal/ai/benchmark/cleanup`

Modes:
1. `delete-linked-trips` -> hard-delete benchmark trips linked to session.
2. `delete-session-data` -> delete benchmark run/session rows.
3. `both` -> delete trips then benchmark rows.

No auto-archive workflow in v1.

## 8.6 Run rating endpoint

`POST /api/internal/ai/benchmark/rating`

Purpose:
1. Persist editable per-run quality ranking for manual QA scoring.
2. Drive benchmark table ranking UI and model-level satisfaction rollups.

Request fields:
1. `runId` (required)
2. `rating` (`good` | `medium` | `bad` | `null`)

## 9) Persistence model (Supabase)

## 9.1 Dedicated benchmark tables

1. `ai_benchmark_sessions`
2. `ai_benchmark_runs`

Suggested schema sketch:

```sql
create table if not exists public.ai_benchmark_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade default auth.uid(),
  share_token text not null unique,
  name text,
  flow text not null check (flow in ('classic','wizard','surprise')),
  scenario jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.ai_benchmark_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_benchmark_sessions(id) on delete cascade,
  provider text not null,
  model text not null,
  label text,
  run_index integer not null default 1,
  status text not null check (status in ('queued','running','completed','failed')),
  latency_ms integer,
  schema_valid boolean,
  validation_checks jsonb,
  validation_errors jsonb,
  usage jsonb,
  cost_usd numeric(12,6),
  request_payload jsonb,
  normalized_trip jsonb,
  trip_id text references public.trips(id) on delete set null,
  trip_ai_meta jsonb,
  error_message text,
  satisfaction_rating text check (satisfaction_rating in ('good','medium','bad')),
  satisfaction_updated_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
```

Validation persistence note:
1. `validation_errors` stores blocking validation failures.
2. `validation_checks` stores granular check booleans plus `validationWarnings` for non-blocking normalization/casing issues.

## 9.2 Benchmark trip tagging strategy (chosen)

Do not add a one-off `isBenchmark` column.

Use existing semantic fields in `trips`:
1. `source_kind = 'ai_benchmark'`
2. `source_template_id = <benchmark_session_id>`

Also add `trip.aiMeta` in trip JSON payload so model/provider remains attached to trip content.

Rationale:
1. Reuses existing source metadata pattern in this repo.
2. Supports future source segmentation beyond benchmarking.
3. Allows reliable bulk delete queries without changing share logic.

## 9.3 Query patterns for cleanup

1. Delete by session:
   `delete from trips where source_kind='ai_benchmark' and source_template_id=:sessionId;`
2. Delete by global benchmark origin:
   `delete from trips where source_kind='ai_benchmark';`

## 10) Benchmark workspace UX

Route: `/admin/ai-benchmark`.

## 10.1 Layout

1. Left: Classic create-trip form.
2. Right top: dynamic provider/model rows (add/remove/search/group/sort).
3. Right actions:
   1. per-row `Run`
   2. global `Test all`
   3. `Download all (ZIP)`
4. Bottom: results table.

## 10.2 Table columns

1. Provider/Model
2. Status
3. Latency ms
4. Structure valid
5. Cost USD
6. Tokens
7. Trip link
8. Export JSON
9. Rerun

## 10.3 Execution strategy

Test-all executes selected rows in parallel with bounded concurrency.

Recommended default:
1. `concurrency = 3`
2. configurable server-side cap to prevent spikes

Reasoning:
1. Faster than strict sequential runs.
2. Lower risk than unbounded parallel fan-out.

## 10.4 Persistence and sharing

1. Session data is persisted on every run.
2. URL includes session token/id for reload and internal share.
3. No benchmark-specific change to normal trip sharing behavior.

## 11) Main create-trip provider selector

## 11.1 Visibility rules (v1)

1. Hidden by default.
2. Visible when simulated login mode is enabled.
3. Default value remains Gemini.

## 11.2 Behavior

1. Selector uses curated catalog only.
2. Submitted selection is sent to `/api/ai/generate`.
3. Endpoint enforces allowlist and falls back/rejects invalid targets.

## 11.3 Future role model

When auth is ready:
1. Replace simulated-login gate with tester/admin role checks.
2. Keep same selector component and route logic.

## 12) Trip UI metadata display

Add lightweight display in trip info modal footer:
1. Provider
2. Model
3. Generated timestamp
4. Benchmark session/run IDs (when available)

This is low-priority visual info for internal validation, not primary end-user content.

## 13) Security model

1. Provider API keys only in server env vars.
2. Internal benchmark endpoints protected by static admin header in v1.
3. Static header must be treated as temporary and replaced in auth rollout.
4. Add request rate limiting and per-session caps.
5. Do not log secrets; log provider/model/latency/usage/error only.

## 13.1 Static header contract (temporary)

1. Header name: `x-tf-admin-key`
2. Value source: `TF_ADMIN_API_KEY` server env var
3. Guard applies to `/api/internal/ai/*`
4. Guard replacement plan is documented in `docs/AUTH_ROLES_IMPLEMENTATION_NOTES.md`
5. Internal benchmark endpoint also expects a Supabase bearer token (`Authorization: Bearer <access_token>`) so DB writes stay owner-scoped under RLS.

## 14) Rollout order

## Phase 0

1. Extract canonical orchestration from current Gemini service.
2. Keep Gemini default behavior unchanged.

## Phase 1

1. Add `/api/ai/generate`.
2. Switch create-trip generation to server endpoint.
3. Add hidden provider/model selector (sim login gated).

## Phase 2

1. Add OpenAI + Anthropic adapters.
2. Add curated OpenRouter adapter entries for free/experimental coverage.

## Phase 3

1. Add benchmark tables and benchmark endpoints.
2. Implement run persistence + single rerun.
3. Implement row JSON export and session ZIP export.

## Phase 4

1. Build `/admin/ai-benchmark` page (Classic form only).
2. Add debug-toolbar shortcut button.

## Phase 5

1. Add cleanup actions for benchmark-tagged trips.
2. Surface provider/gateway usage in admin dashboard.
3. Replace static header auth with role-based auth.

## 15) OpenRouter vs Vercel AI Gateway decision notes

1. Vercel AI Gateway is excellent for routing/fallback/observability, but it is paid infrastructure and not a free unlimited pass-through for premium models.
2. OpenRouter is useful for broad model coverage and curated free-model experiments through one API.
3. Direct provider adapters (OpenAI/Anthropic/Gemini) remain important for reliability and explicit cost control.
4. Practical recommendation:
   1. keep direct adapters for core providers,
   2. use OpenRouter for benchmark breadth/free candidates,
   3. revisit Vercel AI Gateway when centralized observability/fallback becomes worth additional cost.

## 16) Known future rework points

1. Benchmark v1 uses Classic only and will need extension when create flows evolve.
2. Auth/roles are intentionally deferred; static admin header is temporary technical debt.
3. Model catalog curation process should be formalized once tester roles exist.
