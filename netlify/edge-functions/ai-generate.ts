interface GenerateTarget {
  provider?: string;
  model?: string;
}

interface GenerateRequestBody {
  prompt?: string;
  target?: GenerateTarget;
}

interface ProviderUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
}

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const PROVIDER_ALLOWLIST: Record<string, Set<string>> = {
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

const GEMINI_DEFAULT_MODEL = "gemini-3-pro-preview";
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

const readEnv = (name: string): string => {
  try {
    return (globalThis as { Deno?: { env?: { get: (key: string) => string | undefined } } }).Deno?.env?.get(name) || "";
  } catch {
    return "";
  }
};

const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });

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

const ensureModelAllowed = (provider: string, model: string): Response | null => {
  const allowlist = PROVIDER_ALLOWLIST[provider];
  if (!allowlist) {
    return json(400, {
      error: `Unsupported provider '${provider}'.`,
      code: "PROVIDER_NOT_SUPPORTED",
    });
  }

  if (!allowlist.has(model)) {
    return json(400, {
      error: `Model '${model}' is not enabled for provider '${provider}'.`,
      code: "MODEL_NOT_ALLOWED",
    });
  }

  return null;
};

const generateWithGemini = async (prompt: string, model: string) => {
  const apiKey = readEnv("GEMINI_API_KEY") || readEnv("VITE_GEMINI_API_KEY");
  if (!apiKey) {
    return json(500, {
      error: "Gemini API key missing. Configure GEMINI_API_KEY (preferred) or VITE_GEMINI_API_KEY on Netlify.",
      code: "GEMINI_KEY_MISSING",
    });
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
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
  });

  if (!response.ok) {
    const details = await response.text();
    return json(502, {
      error: "Gemini generation request failed.",
      code: "GEMINI_REQUEST_FAILED",
      details: details.slice(0, 1200),
    });
  }

  const payload = await response.json();
  const rawText = (payload?.candidates?.[0]?.content?.parts || [])
    .map((part: { text?: string }) => part?.text || "")
    .join("\n");

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject(rawText);
  } catch (error) {
    return json(502, {
      error: "Gemini response could not be parsed as JSON itinerary payload.",
      code: "GEMINI_PARSE_FAILED",
      details: error instanceof Error ? error.message : "Unknown parsing error",
      sample: rawText.slice(0, 800),
    });
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

  return json(200, {
    data: parsed,
    meta: {
      provider: "gemini",
      model,
      usage,
    },
  });
};

const generateWithOpenAi = async (prompt: string, model: string) => {
  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey) {
    return json(500, {
      error: "OpenAI API key missing. Configure OPENAI_API_KEY on Netlify.",
      code: "OPENAI_KEY_MISSING",
    });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
  });

  if (!response.ok) {
    const details = await response.text();
    return json(502, {
      error: "OpenAI generation request failed.",
      code: "OPENAI_REQUEST_FAILED",
      details: details.slice(0, 1200),
    });
  }

  const payload = await response.json();
  const rawText = extractOpenAiText(payload?.choices?.[0]?.message?.content);

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject(rawText);
  } catch (error) {
    return json(502, {
      error: "OpenAI response could not be parsed as JSON itinerary payload.",
      code: "OPENAI_PARSE_FAILED",
      details: error instanceof Error ? error.message : "Unknown parsing error",
      sample: rawText.slice(0, 800),
    });
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

  return json(200, {
    data: parsed,
    meta: {
      provider: "openai",
      model,
      usage,
    },
  });
};

const resolveAnthropicModel = (model: string): string => {
  return ANTHROPIC_MODEL_MAP[model] || model;
};

const generateWithAnthropic = async (prompt: string, model: string) => {
  const apiKey = readEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json(500, {
      error: "Anthropic API key missing. Configure ANTHROPIC_API_KEY on Netlify.",
      code: "ANTHROPIC_KEY_MISSING",
    });
  }

  const providerModel = resolveAnthropicModel(model);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
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
  });

  if (!response.ok) {
    const details = await response.text();
    return json(502, {
      error: "Anthropic generation request failed.",
      code: "ANTHROPIC_REQUEST_FAILED",
      model,
      providerModel,
      details: details.slice(0, 1200),
    });
  }

  const payload = await response.json();
  const rawText = extractAnthropicText(payload?.content);

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject(rawText);
  } catch (error) {
    return json(502, {
      error: "Anthropic response could not be parsed as JSON itinerary payload.",
      code: "ANTHROPIC_PARSE_FAILED",
      details: error instanceof Error ? error.message : "Unknown parsing error",
      sample: rawText.slice(0, 800),
    });
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

  return json(200, {
    data: parsed,
    meta: {
      provider: "anthropic",
      model,
      providerModel,
      usage,
    },
  });
};

const generateWithOpenRouter = async (prompt: string, model: string) => {
  const apiKey = readEnv("OPENROUTER_API_KEY");
  if (!apiKey) {
    return json(500, {
      error: "OpenRouter API key missing. Configure OPENROUTER_API_KEY on Netlify.",
      code: "OPENROUTER_KEY_MISSING",
    });
  }

  return json(501, {
    error: "OpenRouter backend adapter is not enabled yet in this runtime.",
    code: "OPENROUTER_NOT_ENABLED",
    model,
  });
};

export default async (request: Request) => {
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed. Use POST." });
  }

  let body: GenerateRequestBody;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return json(400, { error: "Missing required field: prompt" });
  }

  const provider = typeof body?.target?.provider === "string"
    ? body.target.provider.trim().toLowerCase()
    : "gemini";

  const model = typeof body?.target?.model === "string" && body.target.model.trim()
    ? body.target.model.trim()
    : GEMINI_DEFAULT_MODEL;

  const allowlistError = ensureModelAllowed(provider, model);
  if (allowlistError) return allowlistError;

  try {
    if (provider === "gemini") {
      return await generateWithGemini(prompt, model);
    }
    if (provider === "openai") {
      return await generateWithOpenAi(prompt, model);
    }
    if (provider === "anthropic") {
      return await generateWithAnthropic(prompt, model);
    }
    return await generateWithOpenRouter(prompt, model);
  } catch (error) {
    return json(500, {
      error: "Unexpected server error during AI generation.",
      code: "AI_GENERATION_UNEXPECTED_ERROR",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
