import {
  GEMINI_DEFAULT_MODEL,
  generateProviderItinerary,
  resolveTimeoutMs,
} from "../edge-lib/ai-provider-runtime.ts";
import { persistAiGenerationTelemetry } from "../edge-lib/ai-generation-telemetry.ts";
import { validateModelData } from "../../shared/aiBenchmarkValidation.ts";
import {
  evaluateAiRuntimeInputSecurity,
  detectAiRuntimeOutputSecurity,
  normalizeAiRuntimeSecurityInput,
  summarizeAiRuntimeSecuritySignals,
} from "../../shared/aiRuntimeSecurity.ts";

interface GenerateTarget {
  provider?: string;
  model?: string;
}

interface GenerateRequestBody {
  prompt?: string;
  target?: GenerateTarget;
  requestId?: string;
  securityInput?: unknown;
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
const GENERIC_SECURITY_BLOCK_MESSAGE = "Trip request could not be processed safely. Please revise the request and try again.";
const GENERIC_OUTPUT_BLOCK_MESSAGE = "Trip generation returned an invalid response. Please try again.";

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
  const requestId = typeof body?.requestId === "string" && body.requestId.trim()
    ? body.requestId.trim()
    : crypto.randomUUID();
  const startedAtMs = Date.now();
  const requestContext = body?.context && typeof body.context === "object"
    ? body.context
    : undefined;
  const securityInput = normalizeAiRuntimeSecurityInput(body?.securityInput);
  const inputSecurityEvaluation = await evaluateAiRuntimeInputSecurity(securityInput);
  const inputSecurity = inputSecurityEvaluation.effectiveSignal;

  if (inputSecurity.blocked) {
    const durationMs = Date.now() - startedAtMs;
    const security = {
      ...summarizeAiRuntimeSecuritySignals([inputSecurity], {
      tripId: requestContext?.tripId || null,
      attemptId: requestContext?.attemptId || null,
    }),
      sanitization: inputSecurityEvaluation.sanitization,
    };
    await persistAiGenerationTelemetry({
      source: "create_trip",
      requestId,
      provider,
      model,
      status: "failed",
      latencyMs: durationMs,
      httpStatus: 422,
      errorCode: "AI_RUNTIME_SECURITY_BLOCKED",
      errorMessage: GENERIC_SECURITY_BLOCK_MESSAGE,
      guardDecision: security.guardDecision,
      riskScore: security.riskScore,
      blocked: security.blocked,
      metadata: {
        endpoint: "/api/ai/generate",
        trip_id: requestContext?.tripId || null,
        attempt_id: requestContext?.attemptId || null,
        flow: requestContext?.flow || null,
        source: requestContext?.source || null,
        retry_of_attempt_id: requestContext?.retryOfAttemptId || null,
        provider_reached: false,
        details: "User-provided trip fields were blocked during input preflight before a provider call was made.",
        security,
      },
    });
    return json(422, {
      error: GENERIC_SECURITY_BLOCK_MESSAGE,
      code: "AI_RUNTIME_SECURITY_BLOCKED",
      meta: {
        requestId,
        durationMs,
        provider,
        model,
        providerModel: null,
        status: 422,
        security,
      },
    });
  }

  const baseSecuritySummary = {
    ...summarizeAiRuntimeSecuritySignals([inputSecurity], {
      tripId: requestContext?.tripId || null,
      attemptId: requestContext?.attemptId || null,
    }),
    sanitization: inputSecurityEvaluation.sanitization,
  };

  let providerReached = false;
  try {
    providerReached = true;
    const result = await generateProviderItinerary({
      prompt,
      provider,
      model,
      timeoutMs: EDGE_REQUEST_PROVIDER_TIMEOUT_MS,
    });
    const durationMs = Date.now() - startedAtMs;

    if (!result.ok) {
      const failureResult = result as {
        ok: false;
        status: number;
        value: {
          error: string;
          code: string;
          details?: string;
          sample?: string;
          providerModel?: string;
        };
      };
      const failure = failureResult.value;
      const outputSecurity = await detectAiRuntimeOutputSecurity({
        rawOutputText: failure.sample || failure.details || failure.error,
        input: securityInput,
        forceSchemaBypass: /parse|json|schema/i.test(failure.code),
      });
      const security = {
        ...summarizeAiRuntimeSecuritySignals([inputSecurity, outputSecurity], {
        tripId: requestContext?.tripId || null,
        attemptId: requestContext?.attemptId || null,
      }),
        sanitization: inputSecurityEvaluation.sanitization,
      };
      await persistAiGenerationTelemetry({
        source: "create_trip",
        requestId,
        provider,
        model,
        providerModel: failure.providerModel,
        status: "failed",
        latencyMs: durationMs,
        httpStatus: failureResult.status,
        errorCode: failure.code,
        errorMessage: failure.error,
        guardDecision: security.guardDecision,
        riskScore: security.riskScore,
        blocked: security.blocked,
        metadata: {
          endpoint: "/api/ai/generate",
          trip_id: requestContext?.tripId || null,
          attempt_id: requestContext?.attemptId || null,
          flow: requestContext?.flow || null,
          source: requestContext?.source || null,
          retry_of_attempt_id: requestContext?.retryOfAttemptId || null,
          provider_reached: true,
          details: failure.details || failure.error || "Provider generation failed before a valid itinerary was returned.",
          security,
        },
      });
      return json(failureResult.status, {
        ...failure,
        meta: {
          requestId,
          durationMs,
          provider,
          model,
          providerModel: failure.providerModel || null,
          status: failureResult.status,
          security,
        },
      });
    }

    const validation = validateModelData(result.value.data);
    const outputSecurity = await detectAiRuntimeOutputSecurity({
      rawOutputText: JSON.stringify(result.value.data),
      parsedData: result.value.data,
      validation,
      input: securityInput,
    });
    const security = {
      ...summarizeAiRuntimeSecuritySignals([inputSecurity, outputSecurity], {
      tripId: requestContext?.tripId || null,
      attemptId: requestContext?.attemptId || null,
    }),
      sanitization: inputSecurityEvaluation.sanitization,
    };

    if (security.blocked) {
      await persistAiGenerationTelemetry({
        source: "create_trip",
        requestId,
        provider: result.value.meta.provider,
        model: result.value.meta.model,
        providerModel: result.value.meta.providerModel,
        status: "failed",
        latencyMs: durationMs,
        httpStatus: 422,
        errorCode: "AI_RUNTIME_SECURITY_BLOCKED",
        errorMessage: GENERIC_OUTPUT_BLOCK_MESSAGE,
        estimatedCostUsd: result.value.meta.usage?.estimatedCostUsd,
        promptTokens: result.value.meta.usage?.promptTokens,
        completionTokens: result.value.meta.usage?.completionTokens,
        totalTokens: result.value.meta.usage?.totalTokens,
        guardDecision: security.guardDecision,
        riskScore: security.riskScore,
        blocked: security.blocked,
        metadata: {
          endpoint: "/api/ai/generate",
          trip_id: requestContext?.tripId || null,
          attempt_id: requestContext?.attemptId || null,
          flow: requestContext?.flow || null,
          source: requestContext?.source || null,
          retry_of_attempt_id: requestContext?.retryOfAttemptId || null,
          provider_reached: true,
          details: "Provider output was rejected after generation because it failed response validation or hard trip constraints.",
          validation: {
            schemaValid: validation.schemaValid,
            errors: validation.errors,
          },
          security,
        },
      });
      return json(422, {
        error: GENERIC_OUTPUT_BLOCK_MESSAGE,
        code: "AI_RUNTIME_SECURITY_BLOCKED",
        meta: {
          ...result.value.meta,
          requestId,
          durationMs,
          status: 422,
          security,
        },
      });
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
      guardDecision: security.guardDecision,
      riskScore: security.riskScore,
      blocked: security.blocked,
      metadata: {
        endpoint: "/api/ai/generate",
        trip_id: requestContext?.tripId || null,
        attempt_id: requestContext?.attemptId || null,
        flow: requestContext?.flow || null,
        source: requestContext?.source || null,
        retry_of_attempt_id: requestContext?.retryOfAttemptId || null,
        provider_reached: true,
        details: inputSecurityEvaluation.sanitization?.applied
          ? "Generation succeeded after sanitizing suspicious instruction-like fragments from user-provided fields."
          : "Generation completed successfully.",
        validation: {
          schemaValid: validation.schemaValid,
          errors: validation.errors,
        },
        security,
      },
    });

    return json(200, {
      data: result.value.data,
      meta: {
        ...result.value.meta,
        requestId,
        durationMs,
        security,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startedAtMs;
    const security = baseSecuritySummary;
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
      guardDecision: security.guardDecision,
      riskScore: security.riskScore,
      blocked: security.blocked,
      metadata: {
        endpoint: "/api/ai/generate",
        trip_id: requestContext?.tripId || null,
        attempt_id: requestContext?.attemptId || null,
        flow: requestContext?.flow || null,
        source: requestContext?.source || null,
        retry_of_attempt_id: requestContext?.retryOfAttemptId || null,
        provider_reached: providerReached,
        details: error instanceof Error ? error.message : "Unknown error",
        security,
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
        security,
      },
    });
  }
};
