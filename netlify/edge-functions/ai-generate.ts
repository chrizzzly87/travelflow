import {
  GEMINI_DEFAULT_MODEL,
  generateProviderItinerary,
  resolveTimeoutMs,
} from "../edge-lib/ai-provider-runtime.ts";
import { persistAiGenerationTelemetry } from "../edge-lib/ai-generation-telemetry.ts";

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
  const requestId = crypto.randomUUID();
  const startedAtMs = Date.now();

  try {
    const result = await generateProviderItinerary({
      prompt,
      provider,
      model,
      timeoutMs: EDGE_REQUEST_PROVIDER_TIMEOUT_MS,
    });
    const durationMs = Date.now() - startedAtMs;

    if (!result.ok) {
      await persistAiGenerationTelemetry({
        source: "create_trip",
        requestId,
        provider,
        model,
        providerModel: result.value.providerModel,
        status: "failed",
        latencyMs: durationMs,
        httpStatus: result.status,
        errorCode: result.value.code,
        errorMessage: result.value.error,
        metadata: {
          endpoint: "/api/ai/generate",
        },
      });
      return json(result.status, result.value);
    }

    await persistAiGenerationTelemetry({
      source: "create_trip",
      requestId,
      provider: result.value.meta.provider,
      model: result.value.meta.model,
      providerModel: result.value.meta.providerModel,
      status: "success",
      latencyMs: durationMs,
      httpStatus: 200,
      estimatedCostUsd: result.value.meta.usage?.estimatedCostUsd,
      promptTokens: result.value.meta.usage?.promptTokens,
      completionTokens: result.value.meta.usage?.completionTokens,
      totalTokens: result.value.meta.usage?.totalTokens,
      metadata: {
        endpoint: "/api/ai/generate",
      },
    });

    return json(200, {
      data: result.value.data,
      meta: {
        ...result.value.meta,
        requestId,
        durationMs,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startedAtMs;
    await persistAiGenerationTelemetry({
      source: "create_trip",
      requestId,
      provider,
      model,
      status: "failed",
      latencyMs: durationMs,
      httpStatus: 500,
      errorCode: "AI_GENERATION_UNEXPECTED_ERROR",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      metadata: {
        endpoint: "/api/ai/generate",
      },
    });
    return json(500, {
      error: "Unexpected server error during AI generation.",
      code: "AI_GENERATION_UNEXPECTED_ERROR",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
