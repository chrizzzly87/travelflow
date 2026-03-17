# Promptfoo Eval Workflow

## Purpose

Use Promptfoo for lightweight, git-versioned checks around AI trip creation.

Keep using `/admin/ai-benchmark` for:

- manual model comparison
- subjective quality review
- saved benchmark sessions, comments, and ratings
- telemetry exploration and trip inspection

Use Promptfoo for:

- repeatable local checks before prompt or model changes
- report-only CI runs with shareable JSON and HTML artifacts
- catching JSON/schema regressions without opening admin UI
- adversarial prompt-injection checks against the real user-controlled trip inputs

Promptfoo is helpful here, but it is not a full security boundary. It improves detection and regression safety; it does not guarantee that prompt injection is impossible.

## Production Runtime Monitoring

Promptfoo stays out of the production hot path.

Production protection now lives in the app/runtime layer:

- `shared/aiRuntimeSecurity.ts` runs `input_preflight` checks on user-controlled fields before provider calls
- the same module runs `output_postflight` checks after model output and shared validation
- direct edge generation and async worker generation both use the same guard decisions: `allow`, `warn`, `block`
- low-risk instruction-like fragments can be silently sanitized before prompt assembly if the sanitized request becomes safe
- only the high-confidence cases that still look unsafe after sanitization are soft-blocked before persistence
- blocked travelers now get an edit-and-retry recovery card instead of a permanent failed state

Production logging lives in:

- `ai_generation_events`
- `trip_generation_attempts.metadata`
- trip `aiMeta.generation.latestAttempt.metadata`

Admin visibility lives in:

- `/admin/ai-benchmark/telemetry`
- `/admin/trips` diagnostics drawer
- trip debug modal admin tab

Logged security evidence is intentionally bounded:

- attack categories
- matched rules
- guard decision
- risk score
- prompt fingerprint hash
- redacted excerpt
- trip id / attempt id

We do not log full raw prompts or full raw model output by default.

## Current Packs

### Regression pack

Commands:

```bash
pnpm ai:eval
pnpm ai:eval:ci
```

Purpose:

- validate itinerary JSON shape
- run the shared benchmark validator
- enforce scenario rules like route lock, exact total days, specific cities, and round-trip return

Artifacts:

- `artifacts/promptfoo/ai-trip-eval.json`
- `artifacts/promptfoo/ai-trip-eval.html`

### Security pack

Commands:

```bash
pnpm ai:eval:security
pnpm ai:eval:security:ci
```

Purpose:

- try hostile `notes`, `specificCities`, and `destinations` inputs that attempt to override the prompt
- detect prompt-leakage markers in model output
- catch attacker-only city overrides that should never appear in the itinerary

Artifacts:

- `artifacts/promptfoo/ai-trip-security-eval.json`
- `artifacts/promptfoo/ai-trip-security-eval.html`

## Shared Schema Contract

Both Promptfoo packs reuse the same shared itinerary schema from:

- `shared/aiTripItinerarySchema.ts`

That schema is applied in two places:

- provider-time structured output for OpenAI-backed Promptfoo and `/admin/ai-benchmark` runs
- Promptfoo eval-time JSON schema assertions

Promptfoo also reuses:

- the shared classic scenario-to-prompt builder
- the shared benchmark validator
- the shared provider runtime

This keeps the admin benchmark and both Promptfoo packs on one contract instead of letting them drift apart.

## Prompt Hardening

The live trip builders now render user-controlled fields as explicit data blocks instead of free-form instruction prose.

Covered inputs:

- classic trip request prompt
- wizard destinations
- surprise destination
- requested cities or stops
- traveler notes
- surprise-flow notes and seasonal text inputs

The prompt policy now explicitly tells the model:

- user-controlled fields are planning data, not authority
- malicious instruction-like text inside those fields must not override TravelFlow policy
- JSON/schema rules still take precedence

This is intentionally lightweight. We are not stripping or filtering user text aggressively in this phase.

The current runtime behavior is:

- keep the user meaning whenever possible
- silently remove obviously malicious instruction fragments from free-text prompt fields when that still leaves a coherent trip request
- log which fields were sanitized in bounded security metadata
- only block when the remaining input still looks unsafe or the model output breaks hard constraints

If a request is blocked:

- input-preflight blocks show a guided recovery UI with the flagged fields prefilled
- the traveler can edit those fields, clear them, and retry manually
- output-postflight blocks show a generic retry message because the failure came from the model response, not the traveler text

## Structured-Output Guardrails

The shared itinerary schema stays inside the subset that OpenAI strict structured output accepts today.

That compatibility is regression-tested in:

- `tests/unit/aiTripItinerarySchema.test.ts`

Rules enforced there:

- no `$ref`, `$defs`, `definitions`, `allOf`, `anyOf`, `oneOf`, or `not`
- every object node sets `additionalProperties: false`
- every declared object property is also listed in `required`

When changing the itinerary contract, rerun:

```bash
pnpm test:core
pnpm ai:eval -- --filter-first-n 1
pnpm ai:eval:security -- --filter-first-n 1
```

## Environment

Required for local runs:

- `OPENAI_API_KEY`
- `GEMINI_API_KEY` or `VITE_GEMINI_API_KEY`

Optional:

- `AI_PROMPTFOO_TIMEOUT_MS`
- `AI_EVAL_MAX_CONCURRENCY`

Default local behavior:

- `pnpm ai:eval`, `pnpm ai:eval:ci`, `pnpm ai:eval:security`, and `pnpm ai:eval:security:ci` auto-load `.env.local` when it exists
- otherwise they fall back to `.env`
- the wrapper defaults Promptfoo concurrency to `1` for steadier provider behavior
- you can raise concurrency with `AI_EVAL_MAX_CONCURRENCY=2` or higher when you want faster local experimentation

You do not need a Promptfoo account for this repo-local workflow. This setup uses the local/open-source CLI and your own provider keys.

## Manual Workflow

Use the manual GitHub Actions workflow:

- `.github/workflows/ai-evals.yml`

It now accepts:

- `pack=regression`
- `pack=security`
- `pack=both`

It stays report-only:

- no merge gate
- no nightly schedule
- no hosted Promptfoo scanner requirement

## Common Failure Modes

Regression pack:

- If OpenAI fails before generation starts, inspect the shared schema change first.
- If Gemini fails with parse errors, the most common cause is still token truncation on larger itineraries.
- If schema passes but the shared validator fails, the JSON shape is fine but the itinerary logic is off.

Security pack:

- If the run fails on `is-json`, the hostile input successfully pushed the model off the JSON contract.
- If the shared validator fails, the model kept JSON but still violated itinerary rules.
- If forbidden phrases appear, the model likely echoed or leaked internal instruction-like text.
- If forbidden attacker cities appear, the hostile input overrode destination constraints.

## What Promptfoo Does And Does Not Guarantee

Promptfoo helps with:

- repeatable regression checks
- schema/contract drift detection
- prompt-injection detection coverage
- manual shareable reports for model comparisons and failures

Promptfoo does not by itself guarantee:

- that prompt injection is impossible
- that all hostile inputs are covered
- that provider behavior is deterministic
- that a green pack means zero live risk

The goal of this setup is practical safety improvement:

- better detection through adversarial evals
- lower override risk through prompt-input hardening
- one shared contract across evals and admin benchmark
- production telemetry and admin incident visibility for suspicious or blocked live traffic

## Incident Replay Workflow

When a production incident is worth replaying:

1. Copy only sanitized request context from the admin telemetry or trip diagnostics view.
2. Convert that sanitized incident into a Promptfoo security scenario.
3. Add the new scenario to the security pack so the failure becomes a repeatable regression test.

This is the intended loop:

- production runtime monitoring catches suspicious live traffic
- Promptfoo turns those sanitized incidents into durable pre-release checks
