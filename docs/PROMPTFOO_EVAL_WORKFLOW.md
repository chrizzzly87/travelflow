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
- the existing provider runtime

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

- output is valid JSON
- required top-level itinerary keys exist
- shared benchmark validator passes
- route-locked scenario preserves city order
- exact-date scenario matches expected day count
- requested specific cities are included
- round-trip scenarios return to the origin city

## CI

Use the manual GitHub Actions workflow:

- `.github/workflows/ai-evals.yml`

It is intentionally report-only and does not block merges.
