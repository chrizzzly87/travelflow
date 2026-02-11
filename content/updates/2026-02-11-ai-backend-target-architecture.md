---
id: rel-2026-02-11-ai-backend-target-architecture
version: v0.46.0
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
