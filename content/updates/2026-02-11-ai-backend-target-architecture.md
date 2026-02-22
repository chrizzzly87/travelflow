---
id: rel-2026-02-11-ai-backend-target-architecture
version: v0.47.0
title: "AI backend target architecture draft"
date: 2026-02-11
published_at: 2026-02-11T06:55:46Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Implemented the first operational benchmark stack with persisted sessions/runs, export/cleanup endpoints, and an admin benchmark workspace."
---

## Changes
- [ ] [Internal] 🧱 Added a concrete target architecture doc for provider-agnostic trip generation, including adapter interfaces, endpoint contracts, and rollout phases.
- [ ] [Internal] 🧪 Defined an internal benchmark workspace design with multi-model test execution, persistent sessions/runs, and shareable result URLs.
- [ ] [Internal] 🧹 Documented benchmark trip tagging plus bulk cleanup flows to archive or purge test-generated trip data safely.
- [ ] [Internal] 🔐 Added a dedicated auth/roles migration note for replacing temporary static admin headers during login/register rollout.
- [ ] [Internal] 🧭 Locked v1 scope decisions for `/admin/ai-benchmark`, Classic-only benchmark inputs, and simulated-login-gated provider selector visibility in `/create-trip`.
- [ ] [Internal] 🧪 Implemented `/admin/ai-benchmark` as an operational workspace with classic benchmark inputs, dynamic model rows, test-all, per-row rerun, persisted table reload, and download/cleanup actions.
- [ ] [Internal] 🗂️ Added a curated AI model catalog for Gemini/OpenAI/Anthropic with preferred/current runtime metadata and estimated per-query cost labels.
- [ ] [Internal] 🎛️ Added a simulated-login-only internal model selector to the classic create-trip flow, grouped by provider and wired to generation options.
- [ ] [Internal] 🧾 Stored AI generation metadata on trips and surfaced provider/model/timestamp in the trip information modal.
- [ ] [Internal] 🌐 Added `/api/ai/generate` edge endpoint for server-side itinerary generation and switched classic generation to call server first with local Gemini fallback.
- [ ] [Internal] 🔑 Added provider/admin environment-key scaffolding (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `TF_ADMIN_API_KEY`) in env docs and Netlify config.
- [ ] [Internal] 🛂 Implemented `/api/internal/ai/benchmark` execution flow with temporary `x-tf-admin-key` guard plus Supabase bearer auth, real model calls, run persistence, and benchmark trip creation/flagging.
- [ ] [Internal] 🗃️ Added benchmark persistence schema (`ai_benchmark_sessions`, `ai_benchmark_runs`) with indexes, updated_at trigger, and owner-scoped RLS policies to `docs/supabase.sql`.
- [ ] [Internal] 🔌 Enabled OpenAI and Anthropic execution paths in `/api/ai/generate` with allowlisted models and server-key checks; OpenRouter remains intentionally disabled for now.
- [ ] [Internal] 📦 Implemented benchmark export endpoints (`run` JSON and `session` ZIP with one file per run) and cleanup endpoint for bulk benchmark trip/session removal.
- [ ] [Internal] 🧩 Added reusable classic prompt builder export and model-catalog release sorting to keep benchmark prompts aligned with create-trip behavior and prioritize newer models in selectors.
- [ ] [Internal] 🎨 Replaced the create-trip internal AI model override dropdown with a styled shadcn/Radix select component to match UI standards.
- [ ] [Internal] 🎨 Upgraded `/admin/ai-benchmark` model/budget/pace selects to styled shadcn/Radix selects with clearer model metadata and preferred/runtime badges.
- [ ] [Internal] 🧭 Documented local testing requirement for internal edge benchmark routes via `npx netlify dev` (`localhost:8888`) instead of Vite-only dev routing.
- [ ] [Internal] ⚡ Added optimistic benchmark table feedback (pre-filled running rows + live latency updates), persisted model-row selections with sensible defaults, and streamlined benchmark action labels/layout.
- [ ] [Internal] 🧷 Changed benchmark trip persistence path to direct `trips` insert for `source_kind='ai_benchmark'` so benchmark runs are not blocked by the normal RPC trip-limit guard.
- [ ] [Internal] ✅ Enforced benchmark output validation gate before trip persistence so structurally-invalid model outputs fail as runs instead of creating empty/low-quality benchmark trips.
- [ ] [Internal] 🎯 Added persisted run ranking (`good`/`medium`/`bad`) with new internal rating endpoint and Supabase schema fields on `ai_benchmark_runs`.
- [ ] [Internal] 📊 Added benchmark table controls for provider filtering, failed/unrated toggles, sortable run timestamp, and a model dashboard with average latency/cost/satisfaction (plus vote/run counts).
- [ ] [Internal] 🧪 Added compact error rendering with JSON-detail modal and syntax-highlighted payload view for failed benchmark runs.
- [ ] [Internal] 🎨 Refined model select option readability with right-aligned badges, cost metadata in options, and short selected labels in triggers (benchmark + create-trip internal selector).
- [ ] [Internal] 🧾 Added a benchmark prompt preview action to generate, inspect, copy, and download the exact full prompt built from current classic benchmark form settings.
- [ ] [Internal] 📦 Extended session ZIP export with optional log bundle support (`includeLogs=1`) to include scenario/prompt artifacts plus run-level diagnostics for prompt iteration.
- [ ] [Internal] 🎨 Standardized AI-generated trip color defaults to the classic palette with explicit palette metadata so new benchmark/runtime trips no longer default to low-contrast pastel map colors.
- [ ] [Internal] 🧼 Removed legacy benchmark palette migration controls from admin/runtime flow; benchmark color consistency now relies on corrected defaults for newly generated benchmark trips.
- [ ] [Internal] 🧰 Improved benchmark error diagnostics by preserving parseable provider error payloads on failed runs and recursively decoding nested/stringified JSON in the error modal.
- [ ] [Internal] 🧭 Added shared transport-mode contract + normalization layer (`shared/transportModes.ts`) and linked update workflow docs to keep enum, aliases, prompt guidance, and UI behavior in sync.
- [ ] [Internal] 🚦 Tightened travel prompt/output contract with explicit canonical transport-mode and duration format rules, including positive/negative examples for faster prompt iteration.
- [ ] [Internal] 🧮 Added shared flexible duration parsers (`shared/durationParsing.ts`) to normalize textual hour/minute values into canonical numeric durations during trip building.
- [ ] [Internal] ✅ Expanded benchmark validation checks for top-level contract, required fields, transport mode formatting, duration formatting, and country info completeness with detailed per-run check modal in admin UI.
- [ ] [Internal] 🎯 Normalized unknown transport modes to `na`, suppressed transport map icons for unset modes, and added dashed unset styling for transportation panels/chips to highlight missing mode selection.
- [ ] [Internal] 🧱 Renamed the canonical runtime generation module to `services/aiService.ts` and kept `services/geminiService.ts` as a backward-compatible re-export shim for staged migration.
- [ ] [Internal] 🚨 Split benchmark validation outcomes into blocking errors vs non-blocking warnings, persisted warning details in run validation payloads, and added warning visibility/filtering in `/admin/ai-benchmark`.
- [ ] [Internal] ⏱️ Switched benchmark execution to async edge background processing (`waitUntil`) with admin-page polling so deployed benchmark runs no longer time out when model generations are slow.
- [ ] [Internal] 🔄 Added benchmark-page startup bootstrap to auto-load the latest persisted benchmark session when no `session` URL param is present, so refresh does not appear to lose prior runs.
- [ ] [Internal] 🛑 Added benchmark cancellation support (`POST /api/internal/ai/benchmark/cancel`) with per-run and per-session abort actions in `/admin/ai-benchmark`.
- [ ] [Internal] 📡 Kept benchmark polling/live-latency updates active after reloading an in-progress session so running rows continue updating until completion or manual abort.
- [ ] [Internal] ⏳ Switched benchmark execution off nested `/api/ai/generate` calls to direct provider runtime execution with a dedicated benchmark timeout budget (`AI_BENCHMARK_PROVIDER_TIMEOUT_MS`, default 90s) to reduce edge timeout failures.
- [ ] [Internal] 🧰 Added provider timeout environment controls for runtime and benchmark paths (`AI_GENERATE_PROVIDER_TIMEOUT_MS`, `AI_BENCHMARK_PROVIDER_TIMEOUT_MS`) and documented expected defaults.
- [ ] [Internal] 🛡️ Enforced a hard 90s minimum benchmark provider timeout so low env overrides (for example `10000`) can no longer force premature benchmark request aborts.
- [ ] [Internal] 🧭 Improved `/admin/ai-benchmark` execution UX by auto-scrolling to results on `Test all`, removing redundant “Left panel” labeling, and tightening the internal auth card layout on small screens.
- [ ] [Internal] 🚦 Increased benchmark parallel execution cap to 5 workers (with automatic queueing for additional selected models) and surfaced this directly in the model-selection UI.
- [ ] [Internal] 💵 Added benchmark cost-display fallback to model-catalog estimates when exact provider `cost_usd` is unavailable, plus clarifying copy in the results section.
- [ ] [Internal] 🧪 Downgraded `countryInfo` benchmark validation failures to non-blocking warnings, tightened AI prompt/schema guidance to require numeric `exchangeRate`, and hardened destination info UI to disable currency conversion when malformed exchange data is returned.
- [ ] [Internal] 🛰️ Replaced the OpenRouter runtime stub with a real adapter call path (JSON extraction, usage/cost metadata capture, and transient 429/5xx retry handling) while keeping provider keys server-only.
- [ ] [Internal] 🤖 Expanded the curated benchmark/runtime model catalog with newer Gemini/OpenAI/Anthropic entries plus curated OpenRouter free-model alternatives for broader comparison coverage.
- [ ] [Internal] 🧪 Added regression tests for provider allowlist enforcement, OpenRouter runtime failure/retry behavior, and model-catalog default/sorting/grouping safeguards.
- [ ] [Internal] 📡 Added persistent AI call telemetry (`ai_generation_events`) for runtime + benchmark execution, capturing provider/model/status/duration/token/cost/error metadata server-side.
- [ ] [Internal] 📊 Added `/api/internal/ai/benchmark/telemetry` plus new admin dashboard telemetry cards/charts/filter controls for time window, source, and provider breakdown.
- [ ] [Internal] 📈 Added Umami custom events for create-trip AI request success/failure and Gemini fallback outcomes to correlate UX and backend behavior.
- [ ] [Internal] 🤖 Expanded Anthropic/OpenRouter model coverage with Claude Sonnet 4.6 plus curated OpenRouter additions (`GLM 5`, `DeepSeek V3.2`, `Grok 4.1 Fast`, `MiniMax M2.5`, `Kimi K2.5`).
- [ ] [Internal] 🚚 Updated feature-branch Netlify deployment guidance to use `dotenv` local build + `netlify deploy --no-build` to prevent masked Supabase browser env values in auth testing.
- [ ] [Internal] 🗄️ Added owner-scoped benchmark preferences persistence (`ai_benchmark_preferences`) plus `/api/internal/ai/benchmark/preferences` so admin model targets and benchmark presets are stored in DB instead of browser local storage.
- [ ] [Internal] 🧩 Refactored `/admin/ai-benchmark` into a compact control surface with modal-based preset editing/creation and modal-based model target management using the global `AppModal` pattern.
- [ ] [Internal] 📈 Added a fixed 7-day telemetry snapshot at the top of `/admin/ai-benchmark` (Tremor cards + charts) and auto-refresh telemetry reload when benchmark runs finish.
- [ ] [Internal] 🧪 Added normalization tests for benchmark preference payload/model-target/preset handling to cover default preset generation and invalid-payload recovery.
- [ ] [Internal] 🧭 Added a dedicated `/admin/ai-benchmark/telemetry` workspace route with richer filters, ranking cards (speed/cost/value), charts, and recent-call diagnostics.
- [ ] [Internal] 🪶 Slimmed `/admin/ai-benchmark` telemetry into a lightweight 7-day quick-view (top fastest/cheapest/best-value model cards) plus direct deep-link to the full telemetry workspace.
- [ ] [Internal] ✅ Changed telemetry model-ranking calculations to use successful calls only, so fastest/cheapest/value leaderboards no longer reward aborted/failed runs.
- [ ] [Internal] 🔁 Added OpenAI runtime fallback from `v1/chat/completions` to `v1/responses` for non-chat model IDs to reduce `OPENAI_REQUEST_FAILED` errors on newer model entries.
- [ ] [Internal] 🎨 Reworked the telemetry workspace with a compact filter strip, modern card wrappers, Tremor KPI cards, Tremor bar-list leaderboards, and deeper chart compositions for trend/provider/model analysis.
