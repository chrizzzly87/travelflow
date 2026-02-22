export interface ProviderUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
}

export interface ProviderGenerationMeta {
  provider: string;
  model: string;
  providerModel?: string;
  usage?: ProviderUsage;
}

export interface ProviderGenerationSuccess {
  data: Record<string, unknown>;
  meta: ProviderGenerationMeta;
}

export interface ProviderGenerationFailurePayload {
  error: string;
  code: string;
  details?: string;
  sample?: string;
  model?: string;
  providerModel?: string;
}

export type ProviderGenerationResult =
  | { ok: true; value: ProviderGenerationSuccess }
  | { ok: false; status: number; value: ProviderGenerationFailurePayload };

export interface ProviderGenerationOptions {
  prompt: string;
  provider: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens?: number;
}

export const PROVIDER_ALLOWLIST: Record<string, Set<string>> = {
  gemini: new Set([
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
    "gemini-3-flash-preview",
    "gemini-3-pro-preview",
    "gemini-3.1-pro-preview",
  ]),
  openai: new Set([
    "gpt-5-nano",
    "gpt-5-mini",
    "gpt-5.2",
    "gpt-5.2-pro",
  ]),
  anthropic: new Set([
    "claude-haiku-4.5",
    "claude-sonnet-4.5",
    "claude-sonnet-4.6",
    "claude-opus-4.6",
    "claude-opus-4.1",
  ]),
  openrouter: new Set([
    "openrouter/free",
    "openai/gpt-oss-20b:free",
    "qwen/qwen3-coder:free",
    "z-ai/glm-5",
    "deepseek/deepseek-v3.2",
    "x-ai/grok-4.1-fast",
    "minimax/minimax-m2.5",
    "moonshotai/kimi-k2.5",
  ]),
};

export const GEMINI_DEFAULT_MODEL = "gemini-3-pro-preview";

const ANTHROPIC_MODEL_MAP: Record<string, string> = {
  "claude-haiku-4.5": "claude-haiku-4-5",
  "claude-sonnet-4.5": "claude-sonnet-4-5",
  "claude-sonnet-4.6": "claude-sonnet-4-6",
  "claude-opus-4.1": "claude-opus-4-1",
  "claude-opus-4.6": "claude-opus-4-6",
  // Backward-compat mapping for catalog/storage values from earlier drafts.
  "claude-haiku-4-5": "claude-haiku-4-5",
  "claude-sonnet-4-6": "claude-sonnet-4-6",
  "claude-sonnet-4-5": "claude-sonnet-4-5",
  "claude-opus-4-6": "claude-opus-4-6",
  "claude-opus-4-1": "claude-opus-4-1",
  "claude-sonnet-4-0": "claude-sonnet-4-0",
  "claude-opus-4-0": "claude-opus-4-0",
};

const GEMINI_PRICING_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash": { input: 0.35, output: 1.05 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-2.5-pro": { input: 3.5, output: 10.5 },
  "gemini-3-flash-preview": { input: 0.35, output: 1.05 },
  "gemini-3-pro-preview": { input: 3.5, output: 10.5 },
  "gemini-3.1-pro-preview": { input: 4.0, output: 12.0 },
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MAX_ATTEMPTS = 2;
const OPENROUTER_RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const PROVIDER_PARSE_RETRY_MAX_ATTEMPTS = 2;

export const readEnv = (name: string): string => {
  try {
    return (globalThis as { Deno?: { env?: { get: (key: string) => string | undefined } } }).Deno?.env?.get(name) || "";
  } catch {
    return "";
  }
};

export const resolveTimeoutMs = (
  envKey: string,
  fallbackMs: number,
  minMs = 1_000,
  maxMs = 180_000,
): number => {
  const rawValue = readEnv(envKey).trim();
  if (!rawValue) return fallbackMs;
  const raw = Number(rawValue);
  if (!Number.isFinite(raw)) return fallbackMs;
  return Math.max(minMs, Math.min(maxMs, Math.round(raw)));
};

const resolveIntegerEnv = (
  envKey: string,
  fallbackValue: number,
  minValue: number,
  maxValue: number,
): number => {
  const rawValue = readEnv(envKey).trim();
  if (!rawValue) return fallbackValue;
  const raw = Number(rawValue);
  if (!Number.isFinite(raw)) return fallbackValue;
  return Math.max(minValue, Math.min(maxValue, Math.round(raw)));
};

const clipText = (value: string, max = 1_200): string => {
  return value.length > max ? value.slice(0, max) : value;
};

const PROVIDER_MAX_OUTPUT_TOKENS = resolveIntegerEnv("AI_PROVIDER_MAX_OUTPUT_TOKENS", 8_192, 1_024, 16_384);

const STRICT_JSON_RETRY_INSTRUCTION = `
IMPORTANT RETRY INSTRUCTIONS:
- Return exactly one valid JSON object and nothing else.
- No markdown fences, no prose, no explanation.
- Keep output compact to avoid truncation.
- For each city description, include all required headings with concise checklist bullets.
`.trim();

const resolveOutputTokenBudget = (override?: number): number => {
  if (!Number.isFinite(override)) return PROVIDER_MAX_OUTPUT_TOKENS;
  const parsed = Math.round(Number(override));
  return Math.max(1_024, Math.min(16_384, parsed));
};

const resolveAttemptTimeoutMs = (requestStartedAt: number, totalTimeoutMs: number): number | null => {
  const elapsed = Date.now() - requestStartedAt;
  const remaining = Math.round(totalTimeoutMs - elapsed);
  if (remaining <= 0) return null;
  return Math.max(250, remaining);
};

const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error && typeof error === "object" && "name" in error) {
    return (error as { name?: string }).name === "AbortError";
  }
  return false;
};

const fetchWithTimeout = async <T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  consume: (response: Response) => Promise<T>,
): Promise<T> => {
  const timeout = Math.max(250, Math.round(timeoutMs));
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutMessage = `Provider request timed out after ${timeout}ms.`;

  try {
    const operation = (async () => {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      return await consume(response);
    })();
    const timeoutPromise = new Promise<T>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(timeoutMessage));
      }, timeout);
    });

    return await Promise.race([operation, timeoutPromise]);
  } catch (error) {
    if (isAbortError(error) || (error instanceof Error && error.message === timeoutMessage)) {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const extractJsonObject = (raw: string): Record<string, unknown> => {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Provider returned empty content.");
  }

  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const withoutFence = fenceMatch ? fenceMatch[1] : trimmed;

  try {
    const parsed = JSON.parse(withoutFence);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Response JSON was not an object.");
    }
    return parsed as Record<string, unknown>;
  } catch {
    const firstBrace = withoutFence.indexOf("{");
    const lastBrace = withoutFence.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("Provider response did not contain valid JSON object boundaries.");
    }

    const candidate = withoutFence.slice(firstBrace, lastBrace + 1);
    const reparsed = JSON.parse(candidate);
    if (!reparsed || typeof reparsed !== "object" || Array.isArray(reparsed)) {
      throw new Error("Response JSON candidate was not an object.");
    }
    return reparsed as Record<string, unknown>;
  }
};

const extractOpenAiText = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (!entry || typeof entry !== "object") return "";
      const text = (entry as { text?: string }).text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n");
};

const extractOpenAiResponsesText = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") return "";
  const typed = payload as Record<string, unknown>;

  if (typeof typed.output_text === "string") {
    return typed.output_text;
  }
  if (Array.isArray(typed.output_text)) {
    return typed.output_text
      .map((entry) => (typeof entry === "string" ? entry : ""))
      .filter(Boolean)
      .join("\n");
  }

  const output = Array.isArray(typed.output) ? typed.output : [];
  return output
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const content = (entry as { content?: unknown }).content;
      if (!Array.isArray(content)) return [];
      return content.map((chunk) => {
        if (!chunk || typeof chunk !== "object") return "";
        const typedChunk = chunk as { text?: string; type?: string };
        if (typeof typedChunk.text === "string") return typedChunk.text;
        if (typedChunk.type === "output_text" && typeof typedChunk.text === "string") return typedChunk.text;
        return "";
      });
    })
    .filter(Boolean)
    .join("\n");
};

const extractAnthropicText = (content: unknown): string => {
  if (!Array.isArray(content)) return "";
  return content
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      const typed = entry as { type?: string; text?: string };
      if (typed.type !== "text") return "";
      return typeof typed.text === "string" ? typed.text : "";
    })
    .filter(Boolean)
    .join("\n");
};

const estimateGeminiCost = (
  model: string,
  promptTokens: number | undefined,
  completionTokens: number | undefined,
): number | undefined => {
  const pricing = GEMINI_PRICING_PER_MILLION[model];
  if (!pricing) return undefined;

  const input = Number.isFinite(promptTokens) ? (promptTokens as number) : 0;
  const output = Number.isFinite(completionTokens) ? (completionTokens as number) : 0;

  const estimated = (input / 1_000_000) * pricing.input + (output / 1_000_000) * pricing.output;
  return Number.isFinite(estimated) ? Number(estimated.toFixed(6)) : undefined;
};

const resolveAnthropicModel = (model: string): string => {
  return ANTHROPIC_MODEL_MAP[model] || model;
};

const isOpenRouterRetryableStatus = (status: number): boolean => {
  return OPENROUTER_RETRYABLE_STATUS.has(status);
};

const toNumberOrUndefined = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseOpenRouterEstimatedCost = (payload: unknown): number | undefined => {
  if (!payload || typeof payload !== "object") return undefined;
  const typed = payload as Record<string, unknown>;
  const usage = typed.usage;
  const usageRecord = usage && typeof usage === "object" ? (usage as Record<string, unknown>) : null;

  const candidate = toNumberOrUndefined(typed.cost)
    ?? toNumberOrUndefined(typed.total_cost)
    ?? toNumberOrUndefined(usageRecord?.cost)
    ?? toNumberOrUndefined(usageRecord?.total_cost);
  return Number.isFinite(candidate) ? Number((candidate as number).toFixed(6)) : undefined;
};

const isOpenAiChatEndpointModelMismatch = (details: string): boolean => {
  const normalized = details.toLowerCase();
  return normalized.includes("not a chat model")
    || normalized.includes("v1/chat/completions")
    || normalized.includes("did you mean to use v1/completions");
};

export const ensureModelAllowed = (
  provider: string,
  model: string,
): ProviderGenerationFailurePayload | null => {
  const allowlist = PROVIDER_ALLOWLIST[provider];
  if (!allowlist) {
    return {
      error: `Unsupported provider '${provider}'.`,
      code: "PROVIDER_NOT_SUPPORTED",
    };
  }

  if (!allowlist.has(model)) {
    return {
      error: `Model '${model}' is not enabled for provider '${provider}'.`,
      code: "MODEL_NOT_ALLOWED",
    };
  }

  return null;
};

const generateWithGemini = async (
  prompt: string,
  model: string,
  timeoutMs: number,
  maxOutputTokens: number,
): Promise<ProviderGenerationResult> => {
  const apiKey = readEnv("GEMINI_API_KEY") || readEnv("VITE_GEMINI_API_KEY");
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      value: {
        error: "Gemini API key missing. Configure GEMINI_API_KEY (preferred) or VITE_GEMINI_API_KEY on Netlify.",
        code: "GEMINI_KEY_MISSING",
      },
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const requestStartedAt = Date.now();
  let strictParseRetry = false;

  for (let attempt = 1; attempt <= PROVIDER_PARSE_RETRY_MAX_ATTEMPTS; attempt += 1) {
    const attemptTimeoutMs = resolveAttemptTimeoutMs(requestStartedAt, timeoutMs);
    if (!attemptTimeoutMs) {
      return {
        ok: false,
        status: 504,
        value: {
          error: "Gemini generation request timed out.",
          code: "GEMINI_REQUEST_TIMEOUT",
          details: `Provider request timed out after ${timeoutMs}ms.`,
        },
      };
    }

    const promptBody = strictParseRetry
      ? `${prompt}\n\n${STRICT_JSON_RETRY_INSTRUCTION}`
      : prompt;

    let payload: unknown;
    try {
      const result = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: promptBody }] }],
            generationConfig: {
              responseMimeType: "application/json",
              maxOutputTokens: maxOutputTokens,
              temperature: strictParseRetry ? 0 : 0.2,
            },
          }),
        },
        attemptTimeoutMs,
        async (response) => {
          if (!response.ok) {
            return {
              ok: false as const,
              status: response.status,
              details: await response.text(),
            };
          }
          return {
            ok: true as const,
            payload: await response.json(),
          };
        },
      );
      if (!result.ok) {
        return {
          ok: false,
          status: 502,
          value: {
            error: "Gemini generation request failed.",
            code: "GEMINI_REQUEST_FAILED",
            details: clipText(result.details),
          },
        };
      }
      payload = result.payload;
    } catch (error) {
      return {
        ok: false,
        status: 504,
        value: {
          error: "Gemini generation request timed out.",
          code: "GEMINI_REQUEST_TIMEOUT",
          details: error instanceof Error ? error.message : "Unknown timeout error",
        },
      };
    }

    const rawText = ((payload as Record<string, unknown>)?.candidates as Array<Record<string, unknown>> | undefined)?.[0]
      ?.content as { parts?: Array<{ text?: string }> } | undefined;
    const joinedText = (rawText?.parts || [])
      .map((part: { text?: string }) => part?.text || "")
      .join("\n");

    let parsed: Record<string, unknown>;
    try {
      parsed = extractJsonObject(joinedText);
    } catch (error) {
      if (attempt < PROVIDER_PARSE_RETRY_MAX_ATTEMPTS) {
        strictParseRetry = true;
        continue;
      }
      return {
        ok: false,
        status: 502,
        value: {
          error: "Gemini response could not be parsed as JSON itinerary payload.",
          code: "GEMINI_PARSE_FAILED",
          details: error instanceof Error ? error.message : "Unknown parsing error",
          sample: joinedText.slice(0, 800),
        },
      };
    }

    const usageMeta = ((payload as Record<string, unknown>)?.usageMetadata || {}) as Record<string, unknown>;
    const promptTokens = Number(usageMeta.promptTokenCount);
    const completionTokens = Number(usageMeta.candidatesTokenCount);
    const totalTokens = Number(usageMeta.totalTokenCount);

    const usage: ProviderUsage = {
      promptTokens: Number.isFinite(promptTokens) ? promptTokens : undefined,
      completionTokens: Number.isFinite(completionTokens) ? completionTokens : undefined,
      totalTokens: Number.isFinite(totalTokens) ? totalTokens : undefined,
      estimatedCostUsd: estimateGeminiCost(
        model,
        Number.isFinite(promptTokens) ? promptTokens : undefined,
        Number.isFinite(completionTokens) ? completionTokens : undefined,
      ),
    };

    return {
      ok: true,
      value: {
        data: parsed,
        meta: {
          provider: "gemini",
          model,
          usage,
        },
      },
    };
  }

  return {
    ok: false,
    status: 502,
    value: {
      error: "Gemini generation request failed.",
      code: "GEMINI_REQUEST_FAILED",
    },
  };
};

const generateWithOpenAi = async (
  prompt: string,
  model: string,
  timeoutMs: number,
  maxOutputTokens: number,
): Promise<ProviderGenerationResult> => {
  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      value: {
        error: "OpenAI API key missing. Configure OPENAI_API_KEY on Netlify.",
        code: "OPENAI_KEY_MISSING",
      },
    };
  }

  const openAiHeaders = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const parseOpenAiJson = (rawText: string, usageMeta: unknown): ProviderGenerationResult => {
    let parsed: Record<string, unknown>;
    try {
      parsed = extractJsonObject(rawText);
    } catch (error) {
      return {
        ok: false,
        status: 502,
        value: {
          error: "OpenAI response could not be parsed as JSON itinerary payload.",
          code: "OPENAI_PARSE_FAILED",
          details: error instanceof Error ? error.message : "Unknown parsing error",
          sample: rawText.slice(0, 800),
        },
      };
    }

    const usage = usageMeta && typeof usageMeta === "object" ? (usageMeta as Record<string, unknown>) : {};
    const promptTokens = Number(usage.prompt_tokens ?? usage.input_tokens);
    const completionTokens = Number(usage.completion_tokens ?? usage.output_tokens);
    const totalTokens = Number(usage.total_tokens);

    return {
      ok: true,
      value: {
        data: parsed,
        meta: {
          provider: "openai",
          model,
          usage: {
            promptTokens: Number.isFinite(promptTokens) ? promptTokens : undefined,
            completionTokens: Number.isFinite(completionTokens) ? completionTokens : undefined,
            totalTokens: Number.isFinite(totalTokens) ? totalTokens : undefined,
          },
        },
      },
    };
  };

  const requestStartedAt = Date.now();

  const chatTimeoutMs = resolveAttemptTimeoutMs(requestStartedAt, timeoutMs);
  if (!chatTimeoutMs) {
    return {
      ok: false,
      status: 504,
      value: {
        error: "OpenAI generation request timed out.",
        code: "OPENAI_REQUEST_TIMEOUT",
        details: `Provider request timed out after ${timeoutMs}ms.`,
      },
    };
  }

  let chatResult:
    | { ok: true; payload: unknown }
    | { ok: false; status: number; details: string };
  try {
    chatResult = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: openAiHeaders,
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "Return only a valid JSON object. Do not include markdown fences.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      },
      chatTimeoutMs,
      async (response) => {
        if (!response.ok) {
          return {
            ok: false as const,
            status: response.status,
            details: await response.text(),
          };
        }
        return {
          ok: true as const,
          payload: await response.json(),
        };
      },
    );
  } catch (error) {
    return {
      ok: false,
      status: 504,
      value: {
        error: "OpenAI generation request timed out.",
        code: "OPENAI_REQUEST_TIMEOUT",
        details: error instanceof Error ? error.message : "Unknown timeout error",
      },
    };
  }

  if (chatResult.ok) {
    const chatPayload = chatResult.payload as Record<string, unknown>;
    const rawText = extractOpenAiText(chatPayload?.choices?.[0]?.message?.content);
    return parseOpenAiJson(rawText, chatPayload?.usage || {});
  }

  const chatFailure = chatResult;
  const chatDetails = chatFailure.details;
  if (!isOpenAiChatEndpointModelMismatch(chatDetails)) {
    return {
      ok: false,
      status: 502,
      value: {
        error: "OpenAI generation request failed.",
        code: "OPENAI_REQUEST_FAILED",
        details: clipText(chatDetails),
      },
    };
  }

  let responsesEndpointResult:
    | { ok: true; payload: unknown }
    | { ok: false; details: string };

  const responsesTimeoutMs = resolveAttemptTimeoutMs(requestStartedAt, timeoutMs);
  if (!responsesTimeoutMs) {
    return {
      ok: false,
      status: 504,
      value: {
        error: "OpenAI generation request timed out.",
        code: "OPENAI_REQUEST_TIMEOUT",
        details: `Provider request timed out after ${timeoutMs}ms.`,
      },
    };
  }

  try {
    responsesEndpointResult = await fetchWithTimeout(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: openAiHeaders,
        body: JSON.stringify({
          model,
          input: [
            {
              role: "system",
              content: "Return only a valid JSON object. Do not include markdown fences.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_output_tokens: maxOutputTokens,
        }),
      },
      responsesTimeoutMs,
      async (response) => {
        if (!response.ok) {
          return {
            ok: false as const,
            details: await response.text(),
          };
        }
        return {
          ok: true as const,
          payload: await response.json(),
        };
      },
    );
  } catch (error) {
    return {
      ok: false,
      status: 504,
      value: {
        error: "OpenAI generation request timed out.",
        code: "OPENAI_REQUEST_TIMEOUT",
        details: error instanceof Error ? error.message : "Unknown timeout error",
      },
    };
  }

  if (!responsesEndpointResult.ok) {
    const responsesFailure = responsesEndpointResult;
    return {
      ok: false,
      status: 502,
      value: {
        error: "OpenAI generation request failed.",
        code: "OPENAI_REQUEST_FAILED",
        details: clipText(`chat_completions: ${chatDetails}\nresponses: ${responsesFailure.details}`),
      },
    };
  }

  const responsesPayload = responsesEndpointResult.payload as Record<string, unknown>;
  const rawText = extractOpenAiResponsesText(responsesPayload);
  return parseOpenAiJson(rawText, responsesPayload?.usage || {});
};

const generateWithAnthropic = async (
  prompt: string,
  model: string,
  timeoutMs: number,
  maxOutputTokens: number,
): Promise<ProviderGenerationResult> => {
  const apiKey = readEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      value: {
        error: "Anthropic API key missing. Configure ANTHROPIC_API_KEY on Netlify.",
        code: "ANTHROPIC_KEY_MISSING",
      },
    };
  }

  const providerModel = resolveAnthropicModel(model);

  const requestStartedAt = Date.now();
  let strictParseRetry = false;

  for (let attempt = 1; attempt <= PROVIDER_PARSE_RETRY_MAX_ATTEMPTS; attempt += 1) {
    const attemptTimeoutMs = resolveAttemptTimeoutMs(requestStartedAt, timeoutMs);
    if (!attemptTimeoutMs) {
      return {
        ok: false,
        status: 504,
        value: {
          error: "Anthropic generation request timed out.",
          code: "ANTHROPIC_REQUEST_TIMEOUT",
          details: `Provider request timed out after ${timeoutMs}ms.`,
        },
      };
    }

    let payload: unknown;
    try {
      const result = await fetchWithTimeout(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: providerModel,
            max_tokens: maxOutputTokens,
            temperature: strictParseRetry ? 0 : 0.2,
            system: strictParseRetry
              ? "Return exactly one minified JSON object. No prose, no markdown fences."
              : "Return only a valid JSON object. Do not include markdown fences.",
            messages: [
              {
                role: "user",
                content: strictParseRetry
                  ? `${prompt}\n\n${STRICT_JSON_RETRY_INSTRUCTION}`
                  : prompt,
              },
            ],
          }),
        },
        attemptTimeoutMs,
        async (response) => {
          if (!response.ok) {
            return {
              ok: false as const,
              details: await response.text(),
            };
          }
          return {
            ok: true as const,
            payload: await response.json(),
          };
        },
      );
      if (!result.ok) {
        return {
          ok: false,
          status: 502,
          value: {
            error: "Anthropic generation request failed.",
            code: "ANTHROPIC_REQUEST_FAILED",
            model,
            providerModel,
            details: clipText(result.details),
          },
        };
      }
      payload = result.payload;
    } catch (error) {
      return {
        ok: false,
        status: 504,
        value: {
          error: "Anthropic generation request timed out.",
          code: "ANTHROPIC_REQUEST_TIMEOUT",
          details: error instanceof Error ? error.message : "Unknown timeout error",
        },
      };
    }

    const rawText = extractAnthropicText((payload as Record<string, unknown>)?.content);

    let parsed: Record<string, unknown>;
    try {
      parsed = extractJsonObject(rawText);
    } catch (error) {
      if (attempt < PROVIDER_PARSE_RETRY_MAX_ATTEMPTS) {
        strictParseRetry = true;
        continue;
      }
      return {
        ok: false,
        status: 502,
        value: {
          error: "Anthropic response could not be parsed as JSON itinerary payload.",
          code: "ANTHROPIC_PARSE_FAILED",
          details: error instanceof Error ? error.message : "Unknown parsing error",
          sample: rawText.slice(0, 800),
        },
      };
    }

    const usageMeta = ((payload as Record<string, unknown>)?.usage || {}) as Record<string, unknown>;
    const promptTokens = Number(usageMeta.input_tokens);
    const completionTokens = Number(usageMeta.output_tokens);
    const totalTokens = Number.isFinite(promptTokens) && Number.isFinite(completionTokens)
      ? promptTokens + completionTokens
      : NaN;

    const usage: ProviderUsage = {
      promptTokens: Number.isFinite(promptTokens) ? promptTokens : undefined,
      completionTokens: Number.isFinite(completionTokens) ? completionTokens : undefined,
      totalTokens: Number.isFinite(totalTokens) ? totalTokens : undefined,
    };

    return {
      ok: true,
      value: {
        data: parsed,
        meta: {
          provider: "anthropic",
          model,
          providerModel,
          usage,
        },
      },
    };
  }

  return {
    ok: false,
    status: 502,
    value: {
      error: "Anthropic generation request failed.",
      code: "ANTHROPIC_REQUEST_FAILED",
      model,
      providerModel,
    },
  };
};

const generateWithOpenRouter = async (
  prompt: string,
  model: string,
  timeoutMs: number,
  maxOutputTokens: number,
): Promise<ProviderGenerationResult> => {
  const apiKey = readEnv("OPENROUTER_API_KEY");
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      value: {
        error: "OpenRouter API key missing. Configure OPENROUTER_API_KEY on Netlify.",
        code: "OPENROUTER_KEY_MISSING",
      },
    };
  }

  const origin = readEnv("SITE_URL") || readEnv("VITE_SITE_URL");
  const appTitle = readEnv("OPENROUTER_APP_NAME") || "TravelFlow";

  let lastError: ProviderGenerationResult | null = null;
  let forceStrictJson = false;
  const requestStartedAt = Date.now();

  for (let attempt = 1; attempt <= OPENROUTER_MAX_ATTEMPTS; attempt += 1) {
    const attemptTimeoutMs = resolveAttemptTimeoutMs(requestStartedAt, timeoutMs);
    if (!attemptTimeoutMs) {
      return {
        ok: false,
        status: 504,
        value: {
          error: "OpenRouter generation request timed out.",
          code: "OPENROUTER_REQUEST_TIMEOUT",
          details: `Provider request timed out after ${timeoutMs}ms.`,
        },
      };
    }

    let responseResult:
      | { ok: true; payload: unknown }
      | { ok: false; status: number; details: string };
    try {
      responseResult = await fetchWithTimeout(
        OPENROUTER_URL,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...(origin ? { "HTTP-Referer": origin } : {}),
            ...(appTitle ? { "X-Title": appTitle } : {}),
          },
          body: JSON.stringify({
            model,
            max_tokens: maxOutputTokens,
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: forceStrictJson
                  ? "Return exactly one minified JSON object that follows the requested schema. No prose, no markdown, no explanations."
                  : "Return only a valid JSON object. Do not include markdown fences.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
          }),
        },
        attemptTimeoutMs,
        async (response) => {
          if (!response.ok) {
            const normalizedStatus = Number.isFinite(response.status) && response.status > 0
              ? response.status
              : 502;
            return {
              ok: false as const,
              status: normalizedStatus,
              details: await response.text(),
            };
          }
          return {
            ok: true as const,
            payload: await response.json(),
          };
        },
      );
    } catch (error) {
      lastError = {
        ok: false,
        status: 504,
        value: {
          error: "OpenRouter generation request timed out.",
          code: "OPENROUTER_REQUEST_TIMEOUT",
          details: error instanceof Error ? error.message : "Unknown timeout error",
        },
      };
      break;
    }

    if (!responseResult.ok) {
      const responseFailure = responseResult;
      lastError = {
        ok: false,
        status: responseFailure.status,
        value: {
          error: "OpenRouter generation request failed.",
          code: "OPENROUTER_REQUEST_FAILED",
          details: clipText(responseFailure.details),
          model,
        },
      };

      if (attempt < OPENROUTER_MAX_ATTEMPTS && isOpenRouterRetryableStatus(responseFailure.status)) {
        continue;
      }
      return lastError;
    }

    const payload = responseResult.payload as Record<string, unknown>;
    const rawText = extractOpenAiText(payload?.choices?.[0]?.message?.content);

    let parsed: Record<string, unknown>;
    try {
      parsed = extractJsonObject(rawText);
    } catch (error) {
      lastError = {
        ok: false,
        status: 502,
        value: {
          error: "OpenRouter response could not be parsed as JSON itinerary payload.",
          code: "OPENROUTER_PARSE_FAILED",
          details: error instanceof Error ? error.message : "Unknown parsing error",
          sample: rawText.slice(0, 800),
        },
      };
      if (attempt < OPENROUTER_MAX_ATTEMPTS) {
        forceStrictJson = true;
        continue;
      }
      return lastError;
    }

    const usageMeta = payload?.usage && typeof payload.usage === "object"
      ? (payload.usage as Record<string, unknown>)
      : {};
    const promptTokens = Number(usageMeta.prompt_tokens ?? usageMeta.input_tokens);
    const completionTokens = Number(usageMeta.completion_tokens ?? usageMeta.output_tokens);
    const totalTokens = Number(usageMeta.total_tokens);
    const estimatedCostUsd = parseOpenRouterEstimatedCost(payload);
    const providerModel = typeof payload?.model === "string" ? payload.model : undefined;

    const usage: ProviderUsage = {
      promptTokens: Number.isFinite(promptTokens) ? promptTokens : undefined,
      completionTokens: Number.isFinite(completionTokens) ? completionTokens : undefined,
      totalTokens: Number.isFinite(totalTokens) ? totalTokens : undefined,
      estimatedCostUsd,
    };

    return {
      ok: true,
      value: {
        data: parsed,
        meta: {
          provider: "openrouter",
          model,
          providerModel,
          usage,
        },
      },
    };
  }

  if (lastError) {
    return lastError;
  }

  return {
    ok: false,
    status: 502,
    value: {
      error: "OpenRouter generation request failed.",
      code: "OPENROUTER_REQUEST_FAILED",
      model,
    },
  };
};

export const generateProviderItinerary = async (
  options: ProviderGenerationOptions,
): Promise<ProviderGenerationResult> => {
  const provider = options.provider.trim().toLowerCase();
  const model = options.model.trim();
  const maxOutputTokens = resolveOutputTokenBudget(options.maxOutputTokens);

  const allowlistError = ensureModelAllowed(provider, model);
  if (allowlistError) {
    return {
      ok: false,
      status: 400,
      value: allowlistError,
    };
  }

  if (provider === "gemini") {
    return await generateWithGemini(options.prompt, model, options.timeoutMs, maxOutputTokens);
  }
  if (provider === "openai") {
    return await generateWithOpenAi(options.prompt, model, options.timeoutMs, maxOutputTokens);
  }
  if (provider === "anthropic") {
    return await generateWithAnthropic(options.prompt, model, options.timeoutMs, maxOutputTokens);
  }
  return await generateWithOpenRouter(options.prompt, model, options.timeoutMs, maxOutputTokens);
};
