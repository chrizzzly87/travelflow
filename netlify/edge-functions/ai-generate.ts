import {
  GEMINI_DEFAULT_MODEL,
  generateProviderItinerary,
  resolveTimeoutMs,
} from "../edge-lib/ai-provider-runtime.ts";

interface GenerateTarget {
  provider?: string;
  model?: string;
}

interface GenerateRequestBody {
  prompt?: string;
  target?: GenerateTarget;
}

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

// Keep create-trip interactive generation tolerant enough for real model latency.
// This clamps overly aggressive env values (for example 5000ms) to a safer floor.
const EDGE_REQUEST_PROVIDER_TIMEOUT_MS = resolveTimeoutMs("AI_GENERATE_PROVIDER_TIMEOUT_MS", 45_000, 20_000, 120_000);

const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });

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

  try {
    const result = await generateProviderItinerary({
      prompt,
      provider,
      model,
      timeoutMs: EDGE_REQUEST_PROVIDER_TIMEOUT_MS,
    });

    if (!result.ok) {
      return json(result.status, result.value);
    }

    return json(200, {
      data: result.value.data,
      meta: result.value.meta,
    });
  } catch (error) {
    return json(500, {
      error: "Unexpected server error during AI generation.",
      code: "AI_GENERATION_UNEXPECTED_ERROR",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
