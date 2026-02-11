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
}

export const PROVIDER_ALLOWLIST: Record<string, Set<string>> = {
  gemini: new Set([
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-3-flash-preview",
    "gemini-3-pro-preview",
  ]),
  openai: new Set([
    "gpt-5-mini",
    "gpt-5.2",
  ]),
  anthropic: new Set([
    "claude-sonnet-4.5",
    "claude-opus-4.6",
  ]),
  openrouter: new Set(),
};

export const GEMINI_DEFAULT_MODEL = "gemini-3-pro-preview";

const ANTHROPIC_MODEL_MAP: Record<string, string> = {
  "claude-sonnet-4.5": "claude-sonnet-4-0",
  "claude-opus-4.6": "claude-opus-4-0",
  "claude-sonnet-4-0": "claude-sonnet-4-0",
  "claude-opus-4-0": "claude-opus-4-0",
};

const GEMINI_PRICING_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash": { input: 0.35, output: 1.05 },
  "gemini-2.5-pro": { input: 3.5, output: 10.5 },
  "gemini-3-flash-preview": { input: 0.35, output: 1.05 },
  "gemini-3-pro-preview": { input: 3.5, output: 10.5 },
};

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
  const raw = Number(readEnv(envKey));
  if (!Number.isFinite(raw)) return fallbackMs;
  return Math.max(minMs, Math.min(maxMs, Math.round(raw)));
};

const clipText = (value: string, max = 1_200): string => {
  return value.length > max ? value.slice(0, max) : value;
};

const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> => {
  const timeout = Math.max(1_000, Math.round(timeoutMs));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Provider request timed out after ${timeout}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
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

  let response: Response;
  try {
    response = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      },
      timeoutMs,
    );
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

  if (!response.ok) {
    const details = await response.text();
    return {
      ok: false,
      status: 502,
      value: {
        error: "Gemini generation request failed.",
        code: "GEMINI_REQUEST_FAILED",
        details: clipText(details),
      },
    };
  }

  const payload = await response.json();
  const rawText = (payload?.candidates?.[0]?.content?.parts || [])
    .map((part: { text?: string }) => part?.text || "")
    .join("\n");

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject(rawText);
  } catch (error) {
    return {
      ok: false,
      status: 502,
      value: {
        error: "Gemini response could not be parsed as JSON itinerary payload.",
        code: "GEMINI_PARSE_FAILED",
        details: error instanceof Error ? error.message : "Unknown parsing error",
        sample: rawText.slice(0, 800),
      },
    };
  }

  const usageMeta = payload?.usageMetadata || {};
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
};

const generateWithOpenAi = async (
  prompt: string,
  model: string,
  timeoutMs: number,
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

  let response: Response;
  try {
    response = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
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
      timeoutMs,
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

  if (!response.ok) {
    const details = await response.text();
    return {
      ok: false,
      status: 502,
      value: {
        error: "OpenAI generation request failed.",
        code: "OPENAI_REQUEST_FAILED",
        details: clipText(details),
      },
    };
  }

  const payload = await response.json();
  const rawText = extractOpenAiText(payload?.choices?.[0]?.message?.content);

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

  const usageMeta = payload?.usage || {};
  const promptTokens = Number(usageMeta.prompt_tokens);
  const completionTokens = Number(usageMeta.completion_tokens);
  const totalTokens = Number(usageMeta.total_tokens);

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
        provider: "openai",
        model,
        usage,
      },
    },
  };
};

const generateWithAnthropic = async (
  prompt: string,
  model: string,
  timeoutMs: number,
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

  let response: Response;
  try {
    response = await fetchWithTimeout(
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
          max_tokens: 8192,
          temperature: 0.2,
          system: "Return only a valid JSON object. Do not include markdown fences.",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      },
      timeoutMs,
    );
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

  if (!response.ok) {
    const details = await response.text();
    return {
      ok: false,
      status: 502,
      value: {
        error: "Anthropic generation request failed.",
        code: "ANTHROPIC_REQUEST_FAILED",
        model,
        providerModel,
        details: clipText(details),
      },
    };
  }

  const payload = await response.json();
  const rawText = extractAnthropicText(payload?.content);

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject(rawText);
  } catch (error) {
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

  const usageMeta = payload?.usage || {};
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
};

const generateWithOpenRouter = async (model: string): Promise<ProviderGenerationResult> => {
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

  return {
    ok: false,
    status: 501,
    value: {
      error: "OpenRouter backend adapter is not enabled yet in this runtime.",
      code: "OPENROUTER_NOT_ENABLED",
      model,
    },
  };
};

export const generateProviderItinerary = async (
  options: ProviderGenerationOptions,
): Promise<ProviderGenerationResult> => {
  const provider = options.provider.trim().toLowerCase();
  const model = options.model.trim();

  const allowlistError = ensureModelAllowed(provider, model);
  if (allowlistError) {
    return {
      ok: false,
      status: 400,
      value: allowlistError,
    };
  }

  if (provider === "gemini") {
    return await generateWithGemini(options.prompt, model, options.timeoutMs);
  }
  if (provider === "openai") {
    return await generateWithOpenAi(options.prompt, model, options.timeoutMs);
  }
  if (provider === "anthropic") {
    return await generateWithAnthropic(options.prompt, model, options.timeoutMs);
  }
  return await generateWithOpenRouter(model);
};
