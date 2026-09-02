import {
  resolveTimeoutMs,
} from "../edge-lib/ai-provider-runtime.ts";
import { generatePreparedTripItinerary } from "../edge-lib/ai-trip-generation.ts";
import {
  createTokenBucketRateLimiter,
  getBearerToken,
  resolveClientIp,
  validateGenerateInput,
  verifySupabaseUser,
} from "../edge-lib/ai-generate-guard.ts";
import { persistAiGenerationTelemetry } from "../edge-lib/ai-generation-telemetry.ts";
import { TRIP_ITINERARY_STRUCTURED_OUTPUT_SCHEMA } from "../../shared/aiTripItinerarySchema.ts";

interface GenerateTarget {
  provider?: string;
  model?: string;
}

interface GenerateRequestBody {
  prompt?: string;
  roundTrip?: boolean;
  target?: GenerateTarget;
  requestId?: string;
  context?: {
    tripId?: string;
    attemptId?: string;
    flow?: string;
    source?: string;
    retryOfAttemptId?: string;
  };
}

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

// Keep create-trip interactive generation tolerant enough for real model latency.
// This clamps overly aggressive env values (for example 5000ms) to a safer floor.
const EDGE_REQUEST_PROVIDER_TIMEOUT_MS = resolveTimeoutMs("AI_GENERATE_PROVIDER_TIMEOUT_MS", 45_000, 20_000, 120_000);

// Best-effort per-isolate limiters (see ai-generate-guard.ts for caveats).
// Verified Supabase sessions get a per-user budget; requests without a
// verifiable session share a stricter per-IP budget.
const verifiedUserLimiter = createTokenBucketRateLimiter({ capacity: 10, refillPerMinute: 6 });
const anonymousIpLimiter = createTokenBucketRateLimiter({ capacity: 5, refillPerMinute: 3 });

const json = (status: number, payload: unknown, extraHeaders?: Record<string, string>): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });

export default async (request: Request, context?: { ip?: string }) => {
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed. Use POST." });
  }

  let body: GenerateRequestBody;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const guarded = validateGenerateInput(body);
  if (!guarded.ok) {
    return json(guarded.failure.status, {
      error: guarded.failure.error,
      code: guarded.failure.code,
    });
  }
  const { prompt, provider, model } = guarded.value;

  const authToken = getBearerToken(request);
  let verifiedUserId: string | null = null;
  let verifiedAnonymousSession = false;
  if (authToken) {
    const verification = await verifySupabaseUser(authToken);
    if (verification.ok) {
      verifiedUserId = verification.userId;
      verifiedAnonymousSession = verification.isAnonymous;
    } else if (verification.reason === "invalid") {
      return json(401, {
        error: "Invalid or expired Supabase access token.",
        code: "AUTH_TOKEN_INVALID",
      });
    }
    // reason === "unavailable": auth service/config unreachable — degrade to
    // per-IP limiting instead of failing legitimate traffic.
  }

  const clientIp = resolveClientIp(request, context);
  const rateDecision = verifiedUserId
    ? verifiedUserLimiter.take(`user:${verifiedUserId}`)
    : anonymousIpLimiter.take(`ip:${clientIp}`);
  if (!rateDecision.allowed) {
    return json(429, {
      error: "Too many generation requests. Please retry shortly.",
      code: "RATE_LIMITED",
      retryAfterSeconds: rateDecision.retryAfterSeconds,
    }, { "Retry-After": String(rateDecision.retryAfterSeconds) });
  }

  const requestId = typeof body?.requestId === "string" && body.requestId.trim()
    ? body.requestId.trim()
    : crypto.randomUUID();
  const startedAtMs = Date.now();
  const requestContext = body?.context && typeof body.context === "object"
    ? body.context
    : undefined;

  try {
    const result = await generatePreparedTripItinerary({
      prompt,
      provider,
      model,
      timeoutMs: EDGE_REQUEST_PROVIDER_TIMEOUT_MS,
      jsonSchema: TRIP_ITINERARY_STRUCTURED_OUTPUT_SCHEMA,
      preparation: { roundTrip: body.roundTrip === true },
    });
    const durationMs = Date.now() - startedAtMs;

    if (!result.ok) {
      if (result.kind === "validation") {
        const validationMessage = result.errors.slice(0, 12).join("; ");
        await persistAiGenerationTelemetry({
          source: "create_trip",
          requestId,
          provider: result.meta.provider,
          model: result.meta.model,
          providerModel: result.meta.providerModel,
          status: "failed",
          latencyMs: durationMs,
          httpStatus: 502,
          errorCode: "TRIP_DRAFT_VALIDATION_FAILED",
          errorMessage: validationMessage,
          promptTokens: result.meta.usage?.promptTokens,
          completionTokens: result.meta.usage?.completionTokens,
          totalTokens: result.meta.usage?.totalTokens,
          estimatedCostUsd: result.meta.usage?.estimatedCostUsd,
          metadata: {
            endpoint: "/api/ai/generate",
            trip_id: requestContext?.tripId || null,
            attempt_id: requestContext?.attemptId || null,
            flow: requestContext?.flow || null,
            validation_error_count: result.errors.length,
            semantic_repair: result.repair,
          },
        });
        return json(502, {
          error: "Generated trip draft failed validation.",
          code: "TRIP_DRAFT_VALIDATION_FAILED",
          details: validationMessage,
          meta: {
            requestId,
            durationMs,
            provider: result.meta.provider,
            model: result.meta.model,
            providerModel: result.meta.providerModel || null,
            status: 502,
            semanticRepair: result.repair,
          },
        });
      }
      await persistAiGenerationTelemetry({
        source: "create_trip",
        requestId,
        provider,
        model,
        providerModel: result.failure.providerModel,
        status: "failed",
        latencyMs: durationMs,
        httpStatus: result.status,
        errorCode: result.failure.code,
        errorMessage: result.failure.error,
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
        totalTokens: result.usage?.totalTokens,
        estimatedCostUsd: result.usage?.estimatedCostUsd,
        metadata: {
          endpoint: "/api/ai/generate",
          trip_id: requestContext?.tripId || null,
          attempt_id: requestContext?.attemptId || null,
          flow: requestContext?.flow || null,
          source: requestContext?.source || null,
          retry_of_attempt_id: requestContext?.retryOfAttemptId || null,
          semantic_repair: result.repair,
        },
      });
      return json(result.status, {
        ...result.failure,
        meta: {
          requestId,
          durationMs,
          provider,
          model,
          providerModel: result.failure.providerModel || null,
          status: result.status,
          semanticRepair: result.repair,
        },
      });
    }

    const prepared = result.value.data;
    const generationMeta = result.value.meta;

    await persistAiGenerationTelemetry({
      source: "create_trip",
      requestId,
      provider: generationMeta.provider,
      model: generationMeta.model,
      providerModel: generationMeta.providerModel,
      status: "success",
      latencyMs: durationMs,
      httpStatus: 200,
      estimatedCostUsd: generationMeta.usage?.estimatedCostUsd,
      promptTokens: generationMeta.usage?.promptTokens,
      completionTokens: generationMeta.usage?.completionTokens,
      totalTokens: generationMeta.usage?.totalTokens,
      metadata: {
        endpoint: "/api/ai/generate",
        user_id: verifiedUserId,
        auth: verifiedUserId
          ? (verifiedAnonymousSession ? "supabase_anonymous" : "supabase_user")
          : "unverified",
        trip_id: requestContext?.tripId || null,
        attempt_id: requestContext?.attemptId || null,
        flow: requestContext?.flow || null,
        source: requestContext?.source || null,
        retry_of_attempt_id: requestContext?.retryOfAttemptId || null,
        trip_compiler: prepared.metrics,
        semantic_repair: result.value.repair,
      },
    });

    return json(200, {
      data: prepared.data,
      meta: {
        ...generationMeta,
        requestId,
        durationMs,
        semanticRepair: result.value.repair,
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
        user_id: verifiedUserId,
        auth: verifiedUserId
          ? (verifiedAnonymousSession ? "supabase_anonymous" : "supabase_user")
          : "unverified",
        trip_id: requestContext?.tripId || null,
        attempt_id: requestContext?.attemptId || null,
        flow: requestContext?.flow || null,
        source: requestContext?.source || null,
        retry_of_attempt_id: requestContext?.retryOfAttemptId || null,
      },
    });
    return json(500, {
      error: "Unexpected server error during AI generation.",
      code: "AI_GENERATION_UNEXPECTED_ERROR",
      details: error instanceof Error ? error.message : "Unknown error",
      meta: {
        requestId,
        durationMs,
        provider,
        model,
        providerModel: null,
        status: 500,
      },
    });
  }
};
