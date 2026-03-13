# Promptfoo Eval Workflow

## Purpose

Use Promptfoo for lightweight, git-versioned regression checks around classic AI trip creation.

Keep using `/admin/ai-benchmark` for:

- manual model comparison
- subjective quality review
- saved benchmark sessions, comments, and ratings
- telemetry exploration and trip inspection

Use Promptfoo for:

- repeatable local checks before prompt or model changes
- report-only CI runs with shareable JSON and HTML artifacts
- catching prompt/output regressions without opening admin UI

## Shared Schema Contract

Promptfoo now uses a shared structured-output itinerary schema from:

- `shared/aiTripItinerarySchema.ts`

That schema is applied in two places:

- provider-time structured output for OpenAI-backed Promptfoo and `/admin/ai-benchmark` runs
- Promptfoo eval-time JSON schema assertions

This means the eval pack no longer only checks whether output was parseable after the fact. It now asks OpenAI to produce itinerary JSON that matches the shared schema up front, then still runs the shared benchmark validator and scenario-specific checks afterward for every provider.

Current rollout:

- enabled for Promptfoo evals
- enabled for `/admin/ai-benchmark`
- OpenAI uses provider-enforced structured output
- Gemini currently relies on `application/json` plus shared schema assertions because larger classic itineraries still hit truncation in provider-native strict mode
- not yet enabled for the main user-facing trip generation endpoints

That split is intentional so we can harden the schema safely on regression surfaces first before deciding whether to roll it into live trip creation.

## Current Scope

- Flow: `classic`
- Models:
  - `openai:gpt-5.4`
  - `gemini:gemini-3.1-pro-preview`
- Scenarios:
  - Japan classic baseline
  - Southeast Asia loop
  - Northern Germany short route
  - family route-lock rail plan
  - exact-date Portugal specific-cities plan

The Promptfoo pack reuses:

- the shared classic benchmark scenario-to-prompt builder
- the shared AI benchmark validator
- the shared itinerary structured-output schema
- the existing provider runtime
- the compact benchmark prompt mode to keep eval outputs inside a realistic CI token budget

## Environment

Required for local runs:

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`

Optional:

- `AI_PROMPTFOO_TIMEOUT_MS`

## Commands

Run locally:

```bash
pnpm ai:eval
```

Run the CI-style artifact export locally:

```bash
pnpm ai:eval:ci
```

Artifacts are written to:

- `artifacts/promptfoo/ai-trip-eval.json`
- `artifacts/promptfoo/ai-trip-eval.html`

## What The Pack Checks

- output matches the shared itinerary JSON schema
- shared benchmark validator passes
- route-locked scenario preserves city order
- exact-date scenario matches expected day count
- requested specific cities are included
- round-trip scenarios return to the origin city

## Known Signals To Watch

- If OpenAI fails before generation starts, inspect the shared schema change first because that usually means a structured-output schema compatibility issue.
- If Gemini fails with parse errors, the most common cause is still `MAX_TOKENS` truncation on larger classic itineraries.
- If schema checks pass but the shared validator fails, the shape is right but business rules are still off. Common examples are invalid coordinates, bad city indices, or missing markdown sections.
- If route-lock or exact-date scenarios fail while schema passes, the issue is usually prompt behavior rather than JSON formatting.

## CI

Use the manual GitHub Actions workflow:

- `.github/workflows/ai-evals.yml`

It is intentionally report-only and does not block merges.
