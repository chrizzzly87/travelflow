const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const normalizeFlag = (value) => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
};

const isEnabled = (value) => {
  const normalized = normalizeFlag(value);
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

const resolveBaseUrl = () => {
  const explicit = (process.env.SITE_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const primary = (process.env.URL || "").trim();
  if (primary) return primary.replace(/\/+$/, "");
  const deploy = (process.env.DEPLOY_URL || "").trim();
  if (deploy) return deploy.replace(/\/+$/, "");
  return "";
};

const resolveInteger = (rawValue, fallback, min, max) => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

const invokeBackgroundWorker = async (params) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, params.timeoutMs);

  try {
    const response = await fetch(`${params.baseUrl}/.netlify/functions/ai-generate-worker-background`, {
      method: "POST",
      headers: {
        "x-tf-admin-key": params.adminKey,
        "x-tf-worker-cron": "1",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        limit: params.limit,
      }),
      signal: controller.signal,
    });
    const body = await response.text();
    return {
      status: response.status,
      body,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Background worker trigger failed";
    return {
      status: 202,
      body: JSON.stringify({
        ok: true,
        accepted: false,
        error: message,
      }),
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

const json = (status, payload) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });

export const config = {
  schedule: "*/1 * * * *",
};

export default async () => {
  if (!isEnabled(process.env.AI_GENERATION_ASYNC_WORKER_ENABLED || "")) {
    return json(200, {
      ok: true,
      skipped: true,
      reason: "worker_disabled",
    });
  }

  const adminKey = (process.env.TF_ADMIN_API_KEY || "").trim();
  const baseUrl = resolveBaseUrl();
  if (!adminKey || !baseUrl) {
    return json(200, {
      ok: true,
      skipped: true,
      reason: "missing_configuration",
    });
  }

  const workerLimit = resolveInteger(process.env.AI_GENERATION_ASYNC_WORKER_BATCH || "1", 1, 1, 5);
  const triggerTimeoutMs = resolveInteger(process.env.AI_GENERATION_ASYNC_TRIGGER_TIMEOUT_MS || "8000", 8_000, 2_000, 25_000);
  const invoked = await invokeBackgroundWorker({
    baseUrl,
    adminKey,
    limit: workerLimit,
    timeoutMs: triggerTimeoutMs,
  });

  return new Response(invoked.body, {
    status: invoked.status,
    headers: JSON_HEADERS,
  });
};
