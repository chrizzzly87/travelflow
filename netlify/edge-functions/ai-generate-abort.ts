import { persistAiGenerationTelemetry } from "../edge-lib/ai-generation-telemetry.ts";
import { GEMINI_DEFAULT_MODEL } from "../edge-lib/ai-provider-runtime.ts";

interface AbortBeaconBody {
  requestId?: string;
  tripId?: string;
  attemptId?: string;
  flow?: string;
  source?: string;
  provider?: string;
  model?: string;
  providerModel?: string;
  startedAt?: string;
  sentAt?: string;
  reason?: string;
}

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });

const toIso = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
};

export default async (request: Request) => {
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed. Use POST." });
  }

  let body: AbortBeaconBody;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const requestId = typeof body?.requestId === "string" && body.requestId.trim()
    ? body.requestId.trim()
    : crypto.randomUUID();
  const provider = typeof body?.provider === "string" && body.provider.trim()
    ? body.provider.trim().toLowerCase()
    : "gemini";
  const model = typeof body?.model === "string" && body.model.trim()
    ? body.model.trim()
    : GEMINI_DEFAULT_MODEL;

  const startedAtIso = toIso(body?.startedAt);
  const sentAtIso = toIso(body?.sentAt) || new Date().toISOString();
  const startedAtMs = startedAtIso ? Date.parse(startedAtIso) : Date.now();
  const sentAtMs = Date.parse(sentAtIso);
  const latencyMs = Number.isFinite(sentAtMs) && Number.isFinite(startedAtMs)
    ? Math.max(0, Math.round(sentAtMs - startedAtMs))
    : 0;

  await persistAiGenerationTelemetry({
    source: "create_trip",
    requestId,
    provider,
    model,
    providerModel: typeof body?.providerModel === "string" ? body.providerModel : undefined,
    status: "failed",
    latencyMs,
    httpStatus: 499,
    errorCode: "AI_GENERATION_ABORT_BEACON",
    errorMessage: "Client tab closed while generation was running.",
    metadata: {
      endpoint: "/api/ai/generate/abort",
      trip_id: typeof body?.tripId === "string" ? body.tripId : null,
      attempt_id: typeof body?.attemptId === "string" ? body.attemptId : null,
      flow: typeof body?.flow === "string" ? body.flow : null,
      source: typeof body?.source === "string" ? body.source : null,
      reason: typeof body?.reason === "string" ? body.reason : "page_unload",
      started_at: startedAtIso,
      sent_at: sentAtIso,
    },
  });

  return json(202, {
    ok: true,
    requestId,
  });
};
