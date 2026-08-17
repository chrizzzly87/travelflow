# OpenRouter model research — 2026-08-17

## Scope and method

This is a live-catalog snapshot for TravelFlow's benchmark and itinerary-generation paths. The authoritative inventory was fetched from OpenRouter's public `GET /api/v1/models` endpoint on 2026-08-17 and checked against the individual OpenRouter model pages. OpenRouter documents that this endpoint returns model properties and can sort by catalog creation date; `created` below therefore means the OpenRouter catalog timestamp, not necessarily the vendor's release announcement. The response has no `updated` field. Prices are the catalog's base USD price converted from per-token to per-million-token units. [OpenRouter models API reference](https://openrouter.ai/docs/api/api-reference/models/get-models) · [live model catalog JSON](https://openrouter.ai/api/v1/models)

For TravelFlow, `structured_outputs` is the strongest catalog-level signal for schema-constrained itinerary JSON, while `tools` and `tool_choice` indicate future tool-call compatibility. OpenRouter advises checking those supported parameters and using `require_parameters: true` when a request depends on them. [Structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs) · [Tool calling](https://openrouter.ai/docs/guides/features/tool-calling)

## Recommended additions

| Priority | OpenRouter model ID | Catalog-created | Context | Input / output per 1M tokens | Relevant supported parameters | TravelFlow recommendation |
| --- | --- | ---: | ---: | ---: | --- | --- |
| 1 | `anthropic/claude-sonnet-5` | 2026-06-30 | 1,000,000 | $2.00 / $10.00 | `structured_outputs`, `response_format`, `tools`, `tool_choice`, reasoning | Add to benchmark defaults and trip generation. Best Claude balance in the current catalog; 128k maximum completion. Anthropic calls it the best combination of speed and intelligence. [OpenRouter model page](https://openrouter.ai/anthropic/claude-sonnet-5) · [Anthropic model overview](https://platform.claude.com/docs/en/about-claude/models/overview) |
| 2 | `deepseek/deepseek-v4-flash-0731` | 2026-07-31 | 1,310,720 catalog / 1,048,576 top endpoint | $0.14 / $0.28 | `structured_outputs`, `response_format`, `tools`, `tool_choice`, `parallel_tool_calls`, reasoning | Add to benchmark defaults and trip generation as the low-cost/fast DeepSeek candidate. Use the dated ID to guarantee the July 31 revision. [OpenRouter model page](https://openrouter.ai/deepseek/deepseek-v4-flash-0731) |
| 3 | `deepseek/deepseek-v4-pro-0813` | 2026-08-12 | 1,048,576 | $0.66 / $1.98 base | `structured_outputs`, `response_format`, `tools`, `tool_choice`, reasoning | Add as the newest DeepSeek quality candidate. Catalog pricing has UTC time-band overrides up to $1.32 / $3.96 per 1M, so do not hard-code the base rate as a billing guarantee. [OpenRouter model page](https://openrouter.ai/deepseek/deepseek-v4-pro-0813) |
| 4 | `x-ai/grok-4.6` | 2026-08-12 | 500,000 | $2.00 / $6.00 | `structured_outputs`, `response_format`, `tools`, `tool_choice`, reasoning | Replace Grok 4.5 in the default benchmark set and add for trip generation. Prompts over 200k tokens are catalog-priced at $4.00 / $12.00 per 1M. Supports text, image, and file input. [OpenRouter model page](https://openrouter.ai/x-ai/grok-4.6) |
| 5 | `anthropic/claude-opus-5` | 2026-07-24 | 1,000,000 | $5.00 / $25.00 | `structured_outputs`, `response_format`, `tools`, `tool_choice`, reasoning | Add as an opt-in premium benchmark/trip-generation model, not a broad default because of cost. 128k maximum completion. [OpenRouter model page](https://openrouter.ai/anthropic/claude-opus-5) |
| 6 | `z-ai/glm-5.2` | 2026-06-16 | 1,048,576 | $1.19 / $3.74 | `structured_outputs`, `response_format`, `tools`, `tool_choice`, `parallel_tool_calls`, reasoning | Keep it enabled; it is still the newest stable GLM/Z.ai ID and is already present in TravelFlow. It remains suitable for both benchmark and trip generation. [OpenRouter model page](https://openrouter.ai/z-ai/glm-5.2) |

All six recommended paid IDs are text-output models and advertise both structured output and tool calling in the live catalog.

## Variants, aliases, and stale IDs

### Z.ai / GLM

- `z-ai` is OpenRouter's vendor namespace for Z.ai; GLM and Z.ai are not separate model families in this catalog.
- `z-ai/glm-5.2:batch` is a distinct 512k-context variant at $0.70 / $2.20 per 1M. It advertises structured output and tools, but should stay out of the interactive generation picker until the runtime's batch behavior is deliberately tested. [Batch model page](https://openrouter.ai/z-ai/glm-5.2%3Abatch)
- `z-ai/glm-5.2:free` is a distinct 128k-context free variant. Crucially, the catalog does **not** advertise `response_format`, `structured_outputs`, `tools`, or `tool_choice`; do not use it as the schema-reliability replacement for paid GLM 5.2. [Free model page](https://openrouter.ai/z-ai/glm-5.2%3Afree)
- `z-ai/glm-5v-turbo` is the current newer vision-specific GLM option, but it is not a better text itinerary default than GLM 5.2 and does not advertise `structured_outputs`. [Model page](https://openrouter.ai/z-ai/glm-5v-turbo)

### Anthropic Claude

- `anthropic/claude-opus-5-fast` is a separate fast endpoint at $10 / $50 per 1M—twice Opus 5's base token price. It supports structured output and tools but is poor value for the initial TravelFlow rollout. [Fast model page](https://openrouter.ai/anthropic/claude-opus-5-fast)
- `anthropic/claude-opus-5:batch` and `anthropic/claude-sonnet-5:batch` are separate half-price batch variants. Treat them as explicit variants, not aliases for synchronous IDs. [Opus batch](https://openrouter.ai/anthropic/claude-opus-5%3Abatch) · [Sonnet batch](https://openrouter.ai/anthropic/claude-sonnet-5%3Abatch)
- `anthropic/claude-fable-5` is also newer than TravelFlow's Claude 4.x entries and supports the required parameters, but at $10 / $50 per 1M it costs twice Opus 5 without a clear TravelFlow cost/quality reason to prioritize it. [Model page](https://openrouter.ai/anthropic/claude-fable-5)
- The current OpenRouter capabilities for Sonnet 5 do not include `temperature` or `top_p` (Opus 5 does include `temperature`). TravelFlow should not send one global sampling-parameter set blindly to every model.

### xAI / Grok

- Interpret the user's “x” as xAI, whose OpenRouter namespace is `x-ai`.
- The live catalog contains stable `x-ai/grok-4.20`, not TravelFlow's current `x-ai/grok-4.20-beta`. The stable ID has 2M context, costs $1.25 / $2.50 per 1M below 200k prompt tokens, and advertises structured output and tools. Replace or retire the absent beta ID rather than adding another beta reference. [Model page](https://openrouter.ai/x-ai/grok-4.20)
- `x-ai/grok-4.20-multi-agent` advertises structured output but does **not** advertise `tools` or `tool_choice`, so it is not the safer TravelFlow default despite its name. [Model page](https://openrouter.ai/x-ai/grok-4.20-multi-agent)
- TravelFlow's `x-ai/grok-4.1-fast` is also absent from the 2026-08-17 live catalog. Keep neither absent ID in a “currently usable” picker without an authenticated smoke test.

### DeepSeek

- `deepseek/deepseek-v4-pro` and `deepseek/deepseek-v4-flash` are not confirmed floating aliases to the newest revisions: their catalog names explicitly identify them as the older `0423` revisions. Prefer `deepseek/deepseek-v4-pro-0813` and `deepseek/deepseek-v4-flash-0731` for reproducible benchmarking. [V4 Pro 0423](https://openrouter.ai/deepseek/deepseek-v4-pro) · [V4 Flash 0423](https://openrouter.ai/deepseek/deepseek-v4-flash)
- No DeepSeek V4 `:free` variant appeared in the live catalog snapshot.

### Evergreen “latest” pointers

The live catalog also exposes hidden tilde-prefixed pointers: `~anthropic/claude-sonnet-latest`, `~anthropic/claude-opus-latest`, `~anthropic/claude-fable-latest`, `~x-ai/grok-latest`, and `~deepseek/deepseek-v4-flash-latest`. These are valid catalog IDs, but pinned IDs are the right benchmark choice because a “latest” pointer can change the underlying behavior while retaining the same stored model label. Do not confuse these with the paid/free/batch variants above. [Live model catalog JSON](https://openrouter.ai/api/v1/models)

## Microsoft / Copilot finding

GitHub Copilot is not exposed as an OpenRouter model namespace or model ID. The live OpenRouter catalog contains no model with `copilot` in its ID or name. Under the `microsoft/` namespace it contains only:

| OpenRouter model ID | Catalog-created | Context | Input / output per 1M | Suitability |
| --- | ---: | ---: | ---: | --- |
| `microsoft/phi-4` | 2025-01-10 | 16,384 | $0.07 / $0.14 | Advertises structured output, but no `tools` or `tool_choice`; too old and context-constrained to call a “newest Copilot” addition. [Model page](https://openrouter.ai/microsoft/phi-4) |
| `microsoft/wizardlm-2-8x22b` | 2024-04-16 | 65,535 | $0.62 / $0.62 | No structured-output or tool support advertised; not recommended. [Model page](https://openrouter.ai/microsoft/wizardlm-2-8x22b) |

GitHub's official Copilot catalog currently lists Microsoft-native `MAI-Code-1-Flash` and `MAI-Code-1.1-Flash`, but neither ID appears in OpenRouter's live catalog. This confirms that “available in Copilot” does not mean “callable through OpenRouter.” [GitHub Copilot supported models](https://docs.github.com/en/copilot/reference/ai-models/supported-models)

Recommendation: do not invent a `copilot/...` ID and do not add either Microsoft OpenRouter model merely to satisfy the label. If “Copilot” means the GitHub Copilot product/model catalog rather than OpenRouter, that is a separate provider integration and outside this OpenRouter feature.

## Implementation handoff

1. Add `anthropic/claude-sonnet-5`, `deepseek/deepseek-v4-flash-0731`, `deepseek/deepseek-v4-pro-0813`, `x-ai/grok-4.6`, and `anthropic/claude-opus-5` to both the UI catalog and server allowlist.
2. Keep `z-ai/glm-5.2`; it already matches the newest stable GLM entry.
3. Retire or replace the catalog-absent `x-ai/grok-4.20-beta` and `x-ai/grok-4.1-fast`; the current stable replacement for the former is `x-ai/grok-4.20`.
4. Use only paid variants for the first production trip-generation test. The GLM free variant lacks the catalog signals TravelFlow needs for reliable structured JSON.
5. Do not apply Sonnet 5's unsupported sampling parameters globally, and use the conservative 1,048,576-token endpoint limit for DeepSeek Flash if TravelFlow displays or enforces context limits.
6. Before deployment, run authenticated generation smoke tests for every proposed ID. Public-catalog presence proves discoverability, not that the project's OpenRouter account, region, privacy settings, or provider routing can execute it.
