import { readEnv } from "./ai-provider-runtime.ts";

export type AiTelemetrySource = "create_trip" | "benchmark";
export type AiTelemetryStatus = "success" | "failed";

export interface PersistAiGenerationTelemetryInput {
  source: AiTelemetrySource;
  requestId: string;
  provider: string;
  model: string;
  providerModel?: string;
  status: AiTelemetryStatus;
  latencyMs: number;
  httpStatus: number;
  errorCode?: string;
  errorMessage?: string;
  estimatedCostUsd?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  benchmarkSessionId?: string;
  benchmarkRunId?: string;
  metadata?: Record<string, unknown>;
}

const MAX_ERROR_MESSAGE_LENGTH = 800;

const clipText = (value: string, max: number): string => {
  return value.length > max ? value.slice(0, max) : value;
};

const toNullableNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getTelemetryConfig = (): { url: string; serviceRoleKey: string } | null => {
  const url = readEnv("VITE_SUPABASE_URL").replace(/\/+$/, "");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
};

export const persistAiGenerationTelemetry = async (
  input: PersistAiGenerationTelemetryInput,
): Promise<boolean> => {
  const config = getTelemetryConfig();
  if (!config) return false;

  const payload = {
    source: input.source,
    request_id: input.requestId || crypto.randomUUID(),
    provider: input.provider,
    model: input.model,
    provider_model: input.providerModel || null,
    status: input.status,
    latency_ms: Math.max(0, Math.round(toNullableNumber(input.latencyMs) || 0)),
    http_status: Math.max(0, Math.round(toNullableNumber(input.httpStatus) || 0)),
    error_code: input.errorCode || null,
    error_message: input.errorMessage ? clipText(input.errorMessage, MAX_ERROR_MESSAGE_LENGTH) : null,
    estimated_cost_usd: toNullableNumber(input.estimatedCostUsd),
    prompt_tokens: toNullableNumber(input.promptTokens),
    completion_tokens: toNullableNumber(input.completionTokens),
    total_tokens: toNullableNumber(input.totalTokens),
    benchmark_session_id: input.benchmarkSessionId || null,
    benchmark_run_id: input.benchmarkRunId || null,
    metadata: input.metadata || null,
  };

  try {
    const response = await fetch(`${config.url}/rest/v1/ai_generation_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
};
