# AI trip generation architecture

## Decision

TravelFlow uses a compact, model-owned trip draft followed by a deterministic server-side compiler.

The model owns only information that requires travel judgment:

- route stops, coordinates, and ISO country codes;
- concise recommendation lists;
- transfer mode and duration;
- activities and their schedule references;
- destination-level country facts.

TravelFlow owns stable presentation and relationship fields:

- English country names;
- recommendation Markdown, headings, and checkboxes;
- travel-segment indices and labels;
- the terminal round-trip marker;
- final semantic validation and the legacy client response shape.

This boundary keeps the existing planner contract stable while reducing generated tokens and preventing parseable-but-partial trips from reaching the client.

## Provider strategy

- OpenAI receives the full strict JSON Schema.
- Gemini receives `responseJsonSchema` with unsupported grammar constraints removed.
- Anthropic receives one forced strict `submit_trip_itinerary` tool with a provider-compatible input schema.
- OpenRouter and the remaining providers continue through the shared structured-output runtime.
- The complete contract is always revalidated locally, regardless of provider enforcement.

Production generation requires 3–4 items in each core recommendation category. Compact benchmark runs use a separate schema that permits one item, so evaluation speed settings cannot lower production quality.

## Failure and rollout behavior

The compiler fails closed on wrong types, missing or extra keys, invalid references, incomplete transfers, overflowing activities, unknown activity types, and Markdown injection attempts. Validation failures retain provider usage and cost telemetry and are classified as quality failures.

The API still returns the established itinerary shape. This makes the change reversible at the server boundary and avoids a coordinated client migration.

## Benchmark: legacy v2 vs compiled v3

Measured on 2026-09-01 with the same Japan round-trip Promptfoo scenario and `openai:gpt-5.4`, three uncached sequential runs per contract:

| Metric | Legacy v2 | Compiled v3 | Change |
| --- | ---: | ---: | ---: |
| Successful runs | 3/3 | 3/3 | unchanged |
| Average latency | 10.160 s | 10.087 s | -0.7% |
| Prompt tokens / run | 2,102 | 1,637 | -22.1% |
| Completion tokens / run | 1,215 | 1,087 | -10.5% |
| Total tokens / run | 3,317 | 2,724 | -17.9% |
| One representative raw output | 4,283 chars | 3,880 chars | -9.4% |

Latency is effectively unchanged in this small sample, while billed token volume drops materially. The v3 compiler expanded the representative 3,880-character draft into the existing 4,625-character client payload without asking the model to generate those stable fields.

## New-model smoke comparison

Authenticated OpenRouter structured-output smoke runs used the v3 schema with required parameter support. These are single-run routing signals, not a quality-ranking dataset.

| Model | Result | Latency | Completion tokens | Cost |
| --- | --- | ---: | ---: | ---: |
| `inception/mercury-2.5-preview` | Parsed at full budget | 3.00 s | 2,097 | $0.000381 |
| `z-ai/glm-5.3-flash` | Parsed | 10.65 s | 1,163 | $0.000556 |
| `qwen/qwen3.8-flash` | Parsed at full budget | 78.38 s | 7,022 | $0.003317 |

Mercury and Qwen both truncated at a 1,800-token cap; GLM completed. Mercury is the speed candidate for a larger quality evaluation, while GLM is the resilience/cost candidate. Qwen is not a speed candidate for this workload. TravelFlow should keep `gpt-5.4` as the production baseline until Mercury and GLM pass the full regression and human itinerary-quality matrix with repeated runs.

## Next benchmark gate

Before changing the default model, run at least three uncached repetitions across the full regression pack and compare:

- schema and compiler success rate;
- route, duration, and requested-city adherence;
- median and worst-case latency;
- prompt and completion tokens;
- cost per successful trip;
- human ratings for route quality, recommendations, and logistics.
