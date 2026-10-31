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

## Follow-up catalog check — 2026-08-17T15:14:50Z

This follow-up re-fetched the live public catalog and also called authenticated `GET /api/v1/models/user` with the OpenRouter key configured in this worktree's `.env.local`. The public response contained 414 models; the account-filtered response contained 413 and returned every recommended model named below, including Gemini 3.7 Flash, Kimi K3, all six GPT-5.6 Luna/Terra/Sol IDs, Grok 4.6, GLM 5.2, Claude 5, and DeepSeek V4. OpenRouter documents that `/models/user` applies the key owner's provider preferences, privacy settings, and guardrails. This is strong evidence that the configured local account may route them, but it is not a completion-level smoke test and does not prove that Netlify production has the same key or account policy. [Authenticated models endpoint](https://openrouter.ai/docs/api/api-reference/models/list-models-user)

### Newly requested families and current omissions

| Status for current branch | Exact OpenRouter ID | Catalog-created | Context / max output | Input / output per 1M tokens | Structured JSON and tools | Recommendation |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Missing; newest Flash in OpenRouter | `google/gemini-3.7-flash` | 2026-08-13T17:03:01Z | 1,048,576 / 65,536 | $0.375 / $1.875 | `response_format`, `structured_outputs`, `tools`, `tool_choice`; mandatory reasoning | Add first as a benchmark candidate and guarded trip-generation option. It has no catalog expiration and its pinned canonical slug is `google/gemini-3.7-flash-20260813`. Google's public model guide had not yet caught up to 3.7 at the time of this check, so do not make it the sole production default until a real itinerary smoke test passes. [OpenRouter model page](https://openrouter.ai/google/gemini-3.7-flash) · [Google's currently published model list](https://ai.google.dev/gemini-api/docs/models) |
| Missing; vendor-confirmed stable baseline | `google/gemini-3.6-flash` | 2026-07-21T15:12:13Z | 1,048,576 / 65,536 | $0.75 / $3.75 on OpenRouter | `response_format`, `structured_outputs`, `tools`, `tool_choice`; mandatory reasoning | Optional historical/GA baseline, not a priority addition: 3.7 supersedes it in OpenRouter and currently lists at half its price. Google calls 3.6 stable and production-ready. [OpenRouter model page](https://openrouter.ai/google/gemini-3.6-flash) · [Google Gemini 3.6 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash) |
| Missing; replaces older Lite benchmark | `google/gemini-3.5-flash-lite` | 2026-07-21T15:12:06Z | 1,048,576 / 65,536 | $0.30 / $2.50 | `response_format`, `structured_outputs`, `tools`, `tool_choice`; mandatory reasoning | Add as the current cheap/high-throughput Google candidate and prefer it over the branch's older Gemini 3.1 Flash Lite in new comparisons. Google identifies it as GA and designed for high-volume structured JSON work. [OpenRouter model page](https://openrouter.ai/google/gemini-3.5-flash-lite) · [Google latest-model guide](https://ai.google.dev/gemini-api/docs/latest-model) |
| Missing | `moonshotai/kimi-k3` | 2026-07-16T15:30:58Z | 1,048,576 / not declared | $3.00 / $15.00 | `response_format`, `structured_outputs`, `tools`, `tool_choice`; reasoning | Add to benchmark and trip generation as the current general-purpose Kimi/Moonshot quality candidate. It supersedes the branch's Kimi K2.5 for “newest model” testing but is materially more expensive. [OpenRouter model page](https://openrouter.ai/moonshotai/kimi-k3) |
| Missing; cost-focused optional | `moonshotai/kimi-k2.6` | 2026-04-20T15:36:42Z | 262,144 / not declared | $0.5605 / $2.36 | `response_format`, `structured_outputs`, `tools`, `tool_choice`, `parallel_tool_calls`; reasoning | Optional general-purpose Kimi cost candidate and a more useful low-price comparison than the branch's K2.5. K3 remains the newest quality candidate. [OpenRouter model page](https://openrouter.ai/moonshotai/kimi-k2.6) |
| Already present | `openai/gpt-5.6-luna` | 2026-07-09T09:54:24Z | 1,050,000 / 128,000 | $0.20 / $1.20 | `response_format`, `structured_outputs`, `tools`, `tool_choice`; optional reasoning | Keep and ensure it is included in speed-focused benchmarks. OpenRouter describes it as the latency/cost tier. Prompts at or above 272k tokens currently increase to $0.40 / $1.80 per 1M. [OpenRouter model page](https://openrouter.ai/openai/gpt-5.6-luna) |
| Already present | `openai/gpt-5.6-luna-pro` | 2026-07-09T09:54:27Z | 1,050,000 / 128,000 | $0.20 / $1.20 | Same as Luna | Keep as the same underlying Luna model with `reasoning.mode=pro`; compare it against ordinary Luna instead of assuming “Pro” is faster. [OpenRouter model page](https://openrouter.ai/openai/gpt-5.6-luna-pro) |
| Already present | `x-ai/grok-4.6` | 2026-08-12T15:35:57Z | 500,000 / not declared | $2.00 / $6.00 | `response_format`, `structured_outputs`, `tools`, `tool_choice`; mandatory reasoning | No additional xAI ID is newer. Keep it as the current Grok candidate; the authenticated user catalog returned it. [OpenRouter model page](https://openrouter.ai/x-ai/grok-4.6) |
| Already present | `z-ai/glm-5.2` | 2026-06-16T17:45:30Z | 1,048,576 / 262,144 | $1.19 / $3.74 | `response_format`, `structured_outputs`, `tools`, `tool_choice`, `parallel_tool_calls`; reasoning | No additional Z.ai ID is newer. Keep it as the current GLM candidate; the authenticated user catalog returned it. [OpenRouter model page](https://openrouter.ai/z-ai/glm-5.2) |

The current branch already contains the complete GPT-5.6 Luna, Terra, and Sol pairs (`openai/gpt-5.6-{luna,terra,sol}` plus each `-pro` variant), so no newer GPT ID is missing. Their current base rates are respectively $0.20/$1.20, $2/$12, and $5/$30 per 1M input/output tokens. Every one advertises structured output and tools, none advertises sampling parameters such as `temperature`, and each has a higher-price override for prompts at or above 272k tokens. For reproducible performance testing, use the exact IDs rather than `~openai/gpt-latest` or `openai/gpt-chat-latest`. [OpenRouter live catalog](https://openrouter.ai/api/v1/models)

`moonshotai/kimi-k2.7-code` is newer than Kimi K2.5 and cheaper than K3 at $0.71/$3.50 per 1M with 262,144 context, structured output, tools, and parallel tool calls. It is coding-focused, so it is notable for catalog completeness but not a priority itinerary model. [OpenRouter model page](https://openrouter.ai/moonshotai/kimi-k2.7-code)

An exact comparison of the branch's 33 `openrouter:` catalog entries with the live public catalog found one stale ID: `qwen/qwen3-coder:free`. It should be treated as unavailable unless an authenticated completion proves otherwise. This is separate from the recommended family additions above and is a useful regression case for catalog-health monitoring. [OpenRouter live catalog](https://openrouter.ai/api/v1/models)

### Sampling-parameter compatibility

OpenRouter's catalog still lists `temperature` and `top_p` for Gemini 3.7/3.6/3.5 Flash models, while Google's July 2026 migration guide says `temperature`, `top_p`, and `top_k` are deprecated for 3.6 Flash, 3.5 Flash Lite, and future Gemini releases. TravelFlow should omit those fields for the new Gemini models despite the broad OpenRouter capability advertisement. OpenAI GPT-5.6 models likewise do not advertise those sampling parameters. Model-specific request construction is safer than globally forwarding them. [Google Gemini release notes](https://ai.google.dev/gemini-api/docs/changelog) · [OpenRouter live catalog](https://openrouter.ai/api/v1/models)

### Can the OpenRouter catalog be synchronized automatically?

OpenRouter's models API provides enough data for a **discovery/advisory sync**, but it should not directly mutate TravelFlow's production allowlist or UI picker.

Relevant model fields are `id`, `canonical_slug`, `name`, `description`, Unix `created`, `expiration_date`, `knowledge_cutoff`, `architecture` and its input/output modalities, `context_length`, `top_provider.context_length`, `top_provider.max_completion_tokens`, string-valued `pricing` plus optional `pricing.overrides`, `supported_parameters`, `default_parameters`, `reasoning`, and `per_request_limits`. The API does not expose a model-level `updated` timestamp. The public `/models` endpoint supports server-side filters including `supported_parameters` (comma-separated values behaved as an all-of filter in this check), input/output modalities, context, author, provider, prompt price, ZDR, EU region, and categories, plus `newest`, price, throughput, latency, popularity, and benchmark sorts. The official `/models/user` contract exposes no such query filters, and live query-string tests still returned the full 413-model user list, so filter that response locally. [Models API reference](https://openrouter.ai/docs/api/api-reference/models/get-models) · [Models guide](https://openrouter.ai/docs/guides/overview/models)

A safe TravelFlow sync would:

1. Query authenticated `/api/v1/models/user`, not only the public catalog, so account privacy preferences and guardrails are reflected.
2. Restrict model authors to a reviewed vendor allowlist and require text output plus `response_format`, `structured_outputs`, `tools`, and `tool_choice` for itinerary candidates.
3. Reject or quarantine tilde aliases, `:free`, `:batch`, preview/beta IDs, expired entries, missing prices, price overrides above a configured ceiling, and records without a usable `top_provider` context/output limit.
4. Persist a normalized snapshot and content hash because there is no `updated` field; diff `id`, `canonical_slug`, capabilities, limits, expiration, and every pricing field/override.
5. Produce an admin/repository review artifact only. A human-reviewed code change should still update the static UI catalog, runtime allowlist, tests, and release note.
6. Run a real structured-itinerary completion with `provider.require_parameters: true` before activation. OpenRouter explains that this prevents routing to an endpoint that would silently ignore required parameters. [Provider routing](https://openrouter.ai/docs/guides/routing/provider-selection)

Automatic metadata alerts are therefore safe; automatic model activation is not. A public or authenticated catalog entry can appear, disappear, change price, gain an expiration, or advertise a parameter that a specific routed endpoint ignores. Endpoint details at this snapshot showed all required JSON/tool parameters on 6/6 Gemini 3.7 endpoints and 4/4 Grok 4.6 endpoints, but only 9/13 Kimi K3 endpoints, 6/7 GPT Luna endpoints, and 28/33 GLM 5.2 endpoints. That aggregate-vs-endpoint mismatch is why `require_parameters: true` is a runtime requirement, not merely a sync filter. TravelFlow should fail closed and preserve its explicit server allowlist. [OpenRouter model endpoint details](https://openrouter.ai/docs/client-sdks/typescript/api-reference/models/models)
