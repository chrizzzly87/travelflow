# OpenRouter Integration Audit (Issue #103)

Date: 2026-02-22  
Scope decision: no Langdock/Langfuse integration in this pass.

## 1) Current runtime path

1. Entry: `POST /api/ai/generate` (`netlify/edge-functions/ai-generate.ts`)
2. Dispatch: `generateProviderItinerary(...)` (`netlify/edge-lib/ai-provider-runtime.ts`)
3. OpenRouter provider execution: `https://openrouter.ai/api/v1/chat/completions`

## 2) What was found before this change

1. OpenRouter existed only as scaffolding (API key check + `501 OPENROUTER_NOT_ENABLED`).
2. OpenRouter allowlist was empty.
3. No OpenRouter usage/cost normalization in provider metadata.
4. No OpenRouter retry path for transient provider failures.

## 3) Improvements implemented in this pass

1. Enabled OpenRouter adapter execution in the shared provider runtime.
2. Added curated OpenRouter allowlist entries for free-model benchmark coverage.
3. Added transient retry handling for OpenRouter `429/5xx` responses (one retry).
4. Added OpenRouter JSON payload parsing and error normalization:
   - `OPENROUTER_REQUEST_FAILED`
   - `OPENROUTER_REQUEST_TIMEOUT`
   - `OPENROUTER_PARSE_FAILED`
5. Added usage normalization (`promptTokens`, `completionTokens`, `totalTokens`) and best-effort `estimatedCostUsd`.

## 4) Metrics that now exist

1. Latency: benchmark run-level `latency_ms` already persisted in `ai_benchmark_runs`.
2. Error rate: benchmark run `status='failed'` plus detailed provider error payloads.
3. Cost: `cost_usd` from provider usage (`estimatedCostUsd`), with model-catalog fallback display already present in admin benchmark UI.

## 5) Test coverage added

1. `tests/unit/aiProviderRuntime.test.ts`
   - OpenRouter allowlist validation
   - missing key behavior
   - successful parse + usage/cost extraction
   - transient failure retry behavior
   - parse-failure behavior
2. `tests/unit/aiModelCatalog.test.ts`
   - model expansion assertions
   - default/runtime guard
   - provider order/grouping checks

## 6) Remaining gaps (intentionally deferred)

1. No external tracing/evals stack integration (Langdock/Langfuse/Portkey/etc.).
2. No adaptive model fallback routing policy in benchmark runs (kept strict per selected target).
