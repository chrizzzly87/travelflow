const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const AUTH_HEADER = "authorization";
const BACKGROUND_DISPATCH_TIMEOUT_MS = 10_000;

interface EnqueueJobRow {
  id: string;
  trip_id: string;
  attempt_id: string;
  state: "queued" | "leased" | "completed" | "failed" | "dead";
}

const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });

const readEnv = (name: string): string => {
  try {
    return (globalThis as { Deno?: { env?: { get: (key: string) => string | undefined } } }).Deno?.env?.get(name) || "";
  } catch {
    return "";
  }
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const safeJsonParse = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const extractErrorMessage = (payload: unknown, fallback: string): string => {
  const record = asObject(payload);
  return asString(record?.message) || asString(record?.error) || fallback;
};

const getAuthToken = (request: Request): string | null => {
  const raw = request.headers.get(AUTH_HEADER) || "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token || null;
};

const getSupabaseConfig = (): { url: string; anonKey: string } | null => {
  const url = readEnv("VITE_SUPABASE_URL").replace(/\/+$/, "");
  const anonKey = readEnv("VITE_SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;
  return { url, anonKey };
};

const buildSupabaseHeaders = (authToken: string, anonKey: string, extra?: Record<string, string>) => ({
  "Content-Type": "application/json",
  apikey: anonKey,
  Authorization: `Bearer ${authToken}`,
  ...extra,
});

const supabaseFetch = async (
  config: { url: string; anonKey: string },
  authToken: string,
  path: string,
  init: RequestInit,
): Promise<Response> => {
  return fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      ...buildSupabaseHeaders(authToken, config.anonKey),
      ...(init.headers || {}),
    },
  });
};

const parseEnqueueRequestBody = (value: unknown): {
  tripId: string;
  attemptId: string;
  payload: Record<string, unknown> | null;
  priority: number | null;
  runAfter: string | null;
  maxRetries: number | null;
} | null => {
  const record = asObject(value);
  if (!record) return null;

  const tripId = asString(record.tripId);
  const attemptId = asString(record.attemptId);
  if (!tripId || !attemptId) return null;

  const payloadValue = record.payload == null ? null : asObject(record.payload);
  if (record.payload != null && !payloadValue) return null;

  return {
    tripId,
    attemptId,
    payload: payloadValue,
    priority: asNumber(record.priority),
    runAfter: asString(record.runAfter),
    maxRetries: asNumber(record.maxRetries),
  };
};

const parseEnqueueJobRow = (value: unknown): EnqueueJobRow | null => {
  const record = asObject(value);
  if (!record) return null;
  const id = asString(record.id);
  const tripId = asString(record.trip_id);
  const attemptId = asString(record.attempt_id);
  const state = asString(record.state);
  if (!id || !tripId || !attemptId || !state) return null;
  if (state !== "queued" && state !== "leased" && state !== "completed" && state !== "failed" && state !== "dead") return null;
  return {
    id,
    trip_id: tripId,
    attempt_id: attemptId,
    state,
  };
};

const dispatchBackgroundWorker = async (
  request: Request,
  adminKey: string,
): Promise<{ accepted: boolean; status: number | null; error: string | null }> => {
  const origin = new URL(request.url).origin.replace(/\/+$/, "");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BACKGROUND_DISPATCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${origin}/.netlify/functions/ai-generate-worker-background`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tf-admin-key": adminKey,
        "x-tf-worker-dispatch-mode": "user",
      },
      body: JSON.stringify({ limit: 1 }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const payload = await safeJsonParse(response);
      return {
        accepted: false,
        status: response.status,
        error: extractErrorMessage(payload, "Background worker dispatch failed."),
      };
    }

    return {
      accepted: true,
      status: response.status,
      error: null,
    };
  } catch (error) {
    return {
      accepted: false,
      status: null,
      error: error instanceof Error ? error.message : "Background worker dispatch failed.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

export default async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  if (request.method !== "POST") {
    return json(405, {
      ok: false,
      error: "Method not allowed. Use POST.",
    });
  }

  const authToken = getAuthToken(request);
  if (!authToken) {
    return json(401, {
      ok: false,
      error: "Missing Authorization bearer token.",
      code: "AUTH_TOKEN_MISSING",
    });
  }

  const supabaseConfig = getSupabaseConfig();
  if (!supabaseConfig) {
    return json(503, {
      ok: false,
      error: "Supabase enqueue config is missing.",
      code: "ASYNC_ENQUEUE_CONFIG_MISSING",
    });
  }

  const body = parseEnqueueRequestBody(await request.json().catch(() => null));
  if (!body) {
    return json(400, {
      ok: false,
      error: "Invalid enqueue payload.",
      code: "ASYNC_ENQUEUE_PAYLOAD_INVALID",
    });
  }

  const enqueueResponse = await supabaseFetch(
    supabaseConfig,
    authToken,
    "/rest/v1/rpc/trip_generation_job_enqueue",
    {
      method: "POST",
      body: JSON.stringify({
        p_trip_id: body.tripId,
        p_attempt_id: body.attemptId,
        p_payload: body.payload,
        p_priority: body.priority,
        p_run_after: body.runAfter,
        p_max_retries: body.maxRetries,
      }),
    },
  );

  if (!enqueueResponse.ok) {
    const payload = await safeJsonParse(enqueueResponse);
    return json(enqueueResponse.status, {
      ok: false,
      error: extractErrorMessage(payload, "Could not enqueue async generation job."),
      code: "ASYNC_ENQUEUE_FAILED",
    });
  }

  const enqueuePayload = await safeJsonParse(enqueueResponse);
  const row = parseEnqueueJobRow(Array.isArray(enqueuePayload) ? enqueuePayload[0] : enqueuePayload);
  if (!row) {
    return json(502, {
      ok: false,
      error: "Async enqueue response was invalid.",
      code: "ASYNC_ENQUEUE_RESPONSE_INVALID",
    });
  }

  const adminKey = readEnv("TF_ADMIN_API_KEY").trim();
  const dispatchResult = adminKey
    ? await dispatchBackgroundWorker(request, adminKey)
    : {
      accepted: false,
      status: null,
      error: "Background worker auth key is missing.",
    };

  return json(200, {
    ok: true,
    job: {
      id: row.id,
      tripId: row.trip_id,
      attemptId: row.attempt_id,
      state: row.state,
    },
    dispatchAccepted: dispatchResult.accepted,
    dispatchStatus: dispatchResult.status,
    dispatchError: dispatchResult.error,
  });
};
