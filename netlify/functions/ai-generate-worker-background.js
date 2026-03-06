import { handleGenerationWorkerRequest } from "../edge-functions/ai-generate-worker.ts";

const normalizeFlag = (value) => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
};

const isEnabled = (value) => {
  const normalized = normalizeFlag(value);
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

const asHeaderValue = (headers, key) => {
  if (!headers || typeof headers !== "object") return "";
  const direct = headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()];
  return typeof direct === "string" ? direct.trim() : "";
};

const jsonResponse = (statusCode, payload) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  },
  body: JSON.stringify(payload),
});

const resolveWorkerUrl = (event) => {
  const providedUrl = asHeaderValue(event?.headers, "x-forwarded-proto")
    && asHeaderValue(event?.headers, "host")
    ? `${asHeaderValue(event.headers, "x-forwarded-proto")}://${asHeaderValue(event.headers, "host")}`
    : "";
  const baseUrl = providedUrl
    || (process.env.SITE_URL || "").trim()
    || (process.env.URL || "").trim()
    || "https://localhost";
  return `${baseUrl.replace(/\/+$/, "")}/api/internal/ai/generation-worker`;
};

const resolveWorkerLimit = (event) => {
  try {
    const parsed = event?.body ? JSON.parse(event.body) : null;
    const raw = Number(parsed?.limit);
    if (Number.isFinite(raw)) {
      return Math.max(1, Math.min(10, Math.round(raw)));
    }
  } catch {
    // noop
  }
  return 1;
};

export const handler = async (event) => {
  if (!isEnabled(process.env.AI_GENERATION_ASYNC_WORKER_ENABLED || "")) {
    return jsonResponse(200, {
      ok: true,
      skipped: true,
      reason: "worker_disabled",
    });
  }

  const expectedKey = (process.env.TF_ADMIN_API_KEY || "").trim();
  const providedKey = asHeaderValue(event?.headers, "x-tf-admin-key");
  if (!expectedKey || !providedKey || expectedKey !== providedKey) {
    return jsonResponse(401, {
      ok: false,
      error: "Unauthorized background worker trigger.",
      code: "WORKER_UNAUTHORIZED",
    });
  }

  const workerLimit = resolveWorkerLimit(event);
  const workerUrl = `${resolveWorkerUrl(event)}?limit=${workerLimit}`;
  const request = new Request(workerUrl, {
    method: "POST",
    headers: {
      "x-tf-admin-key": expectedKey,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  const response = await handleGenerationWorkerRequest(request);
  const body = await response.text();
  return {
    statusCode: response.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body,
  };
};
