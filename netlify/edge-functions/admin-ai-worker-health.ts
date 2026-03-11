import {
  buildAsyncWorkerHealthSummary,
  getAsyncWorkerHealthConfig,
  listRecentAsyncWorkerHealthChecks,
} from "../edge-lib/async-worker-health.ts";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const AUTH_HEADER = "authorization";

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

const safeJsonParse = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const extractServiceError = (payload: unknown, fallback: string): string => {
  if (payload && typeof payload === "object") {
    const typed = payload as Record<string, unknown>;
    if (typeof typed.message === "string" && typed.message.trim()) return typed.message.trim();
    if (typeof typed.error === "string" && typed.error.trim()) return typed.error.trim();
  }
  return fallback;
};

const getAuthToken = (request: Request): string | null => {
  const raw = request.headers.get(AUTH_HEADER) || "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token || null;
};

const getSupabaseConfig = () => {
  const url = readEnv("VITE_SUPABASE_URL").replace(/\/+$/, "");
  const anonKey = readEnv("VITE_SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;
  return { url, anonKey };
};

const buildAnonHeaders = (authToken: string, anonKey: string) => ({
  "Content-Type": "application/json",
  apikey: anonKey,
  Authorization: `Bearer ${authToken}`,
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
      ...buildAnonHeaders(authToken, config.anonKey),
      ...(init.headers || {}),
    },
  });
};

const authorizeAdminRequest = async (
  config: { url: string; anonKey: string },
  authToken: string,
): Promise<Response | null> => {
  const response = await supabaseFetch(config, authToken, "/rest/v1/rpc/get_current_user_access", {
    method: "POST",
    headers: {
      Prefer: "params=single-object",
    },
    body: "{}",
  });

  if (!response.ok) {
    const payload = await safeJsonParse(response);
    return json(403, {
      ok: false,
      error: extractServiceError(payload, "Admin role verification failed."),
      code: "ADMIN_ACCESS_CHECK_FAILED",
    });
  }

  const payload = await safeJsonParse(response);
  const accessRow = Array.isArray(payload) ? payload[0] : payload;
  if (!accessRow || typeof accessRow !== "object" || (accessRow as Record<string, unknown>).system_role !== "admin") {
    return json(403, {
      ok: false,
      error: "Admin access is required.",
      code: "ADMIN_ACCESS_REQUIRED",
    });
  }

  return null;
};

export default async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  if (request.method !== "GET") {
    return json(405, {
      ok: false,
      error: "Method not allowed. Use GET.",
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
  const healthConfig = getAsyncWorkerHealthConfig();
  if (!supabaseConfig || !healthConfig) {
    return json(503, {
      ok: false,
      error: "Worker health config is missing.",
      code: "WORKER_HEALTH_CONFIG_MISSING",
    });
  }

  const authError = await authorizeAdminRequest(supabaseConfig, authToken);
  if (authError) return authError;

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.round(limitRaw))) : 25;

  const checks = await listRecentAsyncWorkerHealthChecks(healthConfig, limit);
  const summary = buildAsyncWorkerHealthSummary(checks);

  return json(200, {
    ok: true,
    summary,
    checks,
  });
};
