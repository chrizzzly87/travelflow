import { readEnv } from "./ai-provider-runtime.ts";

export type AsyncWorkerHealthCheckType = "heartbeat" | "watchdog" | "canary";
export type AsyncWorkerHealthStatus = "ok" | "warning" | "failed";

export interface AsyncWorkerHealthCheckRecord {
  id: string;
  checkType: AsyncWorkerHealthCheckType;
  status: AsyncWorkerHealthStatus;
  startedAt: string;
  finishedAt: string | null;
  staleQueuedCount: number;
  oldestQueuedAgeMs: number | null;
  dispatchAttempted: boolean;
  dispatchHttpStatus: number | null;
  canaryLatencyMs: number | null;
  failureCode: string | null;
  failureMessage: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AsyncWorkerHealthSummary {
  overallStatus: AsyncWorkerHealthStatus;
  statusReason: string;
  heartbeatFresh: boolean;
  canaryFresh: boolean;
  canaryDue: boolean;
  staleQueuedCount: number;
  oldestQueuedAgeMs: number | null;
  lastHeartbeatAt: string | null;
  lastHeartbeatStatus: AsyncWorkerHealthStatus | null;
  lastSelfHealAt: string | null;
  lastSelfHealStatus: AsyncWorkerHealthStatus | null;
  lastCanaryAt: string | null;
  lastCanaryStatus: AsyncWorkerHealthStatus | null;
  lastCanaryLatencyMs: number | null;
}

export interface AsyncWorkerQueueSnapshot {
  staleQueuedCount: number;
  oldestQueuedAgeMs: number | null;
  oldestQueuedUpdatedAt: string | null;
  errorMessage?: string | null;
}

export interface AsyncWorkerCanaryContext {
  tripId: string;
  attemptId: string;
  jobId: string;
  ownerId: string;
  requestId: string;
  startedAt: string;
}

export interface AsyncWorkerCanaryEvaluation {
  status: AsyncWorkerHealthStatus;
  failureCode: string | null;
  failureMessage: string | null;
  latencyMs: number | null;
  jobState: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export const ASYNC_WORKER_STALE_QUEUE_MS = 5 * 60 * 1000;
export const ASYNC_WORKER_HEARTBEAT_STALE_MS = 3 * 60 * 1000;
export const ASYNC_WORKER_CANARY_INTERVAL_MS = 15 * 60 * 1000;
export const ASYNC_WORKER_CANARY_STALE_MS = 30 * 60 * 1000;
export const ASYNC_WORKER_CANARY_CLEANUP_MS = 60 * 60 * 1000;
export const ASYNC_WORKER_CANARY_SOURCE = "async_worker_canary";
export const ASYNC_WORKER_CANARY_SOURCE_KIND = "internal_canary";
const MAX_HEALTH_FAILURE_MESSAGE_LENGTH = 800;

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asBoolean = (value: unknown): boolean => value === true;

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asIsoMs = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clipText = (value: string | null | undefined, max = MAX_HEALTH_FAILURE_MESSAGE_LENGTH): string | null => {
  const normalized = asString(value);
  if (!normalized) return null;
  return normalized.length > max ? normalized.slice(0, max) : normalized;
};

const parseContentRangeCount = (value: string | null): number | null => {
  if (!value) return null;
  const match = value.match(/\/(\d+|\*)$/);
  if (!match || match[1] === "*") return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
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

const buildServiceHeaders = (
  serviceRoleKey: string,
  extra?: Record<string, string>,
): Record<string, string> => ({
  "Content-Type": "application/json",
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  ...extra,
});

export const getAsyncWorkerHealthConfig = (): { url: string; serviceRoleKey: string } | null => {
  const url = readEnv("VITE_SUPABASE_URL").replace(/\/+$/, "");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
};

const serviceFetch = async (
  config: { url: string; serviceRoleKey: string },
  path: string,
  init: RequestInit,
): Promise<Response> => {
  return fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      ...buildServiceHeaders(config.serviceRoleKey),
      ...(init.headers || {}),
    },
  });
};

const parseHealthCheckRecord = (value: unknown): AsyncWorkerHealthCheckRecord | null => {
  const row = asObject(value);
  if (!row) return null;

  const id = asString(row.id);
  const checkType = asString(row.check_type);
  const status = asString(row.status);
  const startedAt = asString(row.started_at);
  const createdAt = asString(row.created_at);
  if (!id || !startedAt || !createdAt) return null;
  if (checkType !== "heartbeat" && checkType !== "watchdog" && checkType !== "canary") return null;
  if (status !== "ok" && status !== "warning" && status !== "failed") return null;

  return {
    id,
    checkType,
    status,
    startedAt,
    finishedAt: asString(row.finished_at),
    staleQueuedCount: Math.max(0, Math.round(asNumber(row.stale_queued_count) || 0)),
    oldestQueuedAgeMs: asNumber(row.oldest_queued_age_ms),
    dispatchAttempted: asBoolean(row.dispatch_attempted),
    dispatchHttpStatus: asNumber(row.dispatch_http_status),
    canaryLatencyMs: asNumber(row.canary_latency_ms),
    failureCode: asString(row.failure_code),
    failureMessage: asString(row.failure_message),
    metadata: asObject(row.metadata),
    createdAt,
  };
};

export const shouldRunAsyncWorkerCanary = (
  checks: AsyncWorkerHealthCheckRecord[],
  nowMs = Date.now(),
  intervalMs = ASYNC_WORKER_CANARY_INTERVAL_MS,
): boolean => {
  const lastCanary = checks.find((row) => row.checkType === "canary") || null;
  const lastAttemptMs = asIsoMs(lastCanary?.finishedAt || lastCanary?.startedAt || null);
  if (lastAttemptMs !== null && nowMs - lastAttemptMs < 5 * 60 * 1000) {
    return false;
  }

  const lastSuccessfulCanary = checks.find((row) => row.checkType === "canary" && row.status === "ok") || null;
  const lastSuccessMs = asIsoMs(lastSuccessfulCanary?.finishedAt || lastSuccessfulCanary?.startedAt || null);
  if (lastSuccessMs === null) return true;
  return nowMs - lastSuccessMs >= intervalMs;
};

export const buildAsyncWorkerHealthSummary = (
  checks: AsyncWorkerHealthCheckRecord[],
  nowMs = Date.now(),
): AsyncWorkerHealthSummary => {
  const lastHeartbeat = checks.find((row) => row.checkType === "heartbeat") || null;
  const lastCanary = checks.find((row) => row.checkType === "canary") || null;
  const lastSelfHeal = checks.find((row) => asBoolean(asObject(row.metadata)?.selfHealAttempted)) || null;

  const lastHeartbeatMs = asIsoMs(lastHeartbeat?.startedAt || null);
  const lastCanaryMs = asIsoMs(lastCanary?.finishedAt || lastCanary?.startedAt || null);
  const heartbeatFresh = lastHeartbeatMs !== null && nowMs - lastHeartbeatMs <= ASYNC_WORKER_HEARTBEAT_STALE_MS;
  const canaryFresh = lastCanaryMs !== null && nowMs - lastCanaryMs <= ASYNC_WORKER_CANARY_STALE_MS;

  let overallStatus: AsyncWorkerHealthStatus = "ok";
  let statusReason = "Worker heartbeat and canary are healthy.";

  if (!lastHeartbeat || !heartbeatFresh) {
    overallStatus = "failed";
    statusReason = "Cron heartbeat is stale or missing.";
  } else if (lastHeartbeat.status === "failed") {
    overallStatus = "failed";
    statusReason = lastHeartbeat.failureMessage || "Latest heartbeat failed.";
  } else if (lastCanary && lastCanary.status === "failed" && canaryFresh) {
    overallStatus = "failed";
    statusReason = lastCanary.failureMessage || "Latest worker canary failed.";
  } else if (!lastCanary || !canaryFresh) {
    overallStatus = "warning";
    statusReason = "Worker canary has not completed recently.";
  } else if (lastHeartbeat.status === "warning" || lastHeartbeat.staleQueuedCount > 0) {
    overallStatus = "warning";
    statusReason = lastHeartbeat.failureMessage || "Stale queued jobs were detected and re-kicked.";
  }

  return {
    overallStatus,
    statusReason,
    heartbeatFresh,
    canaryFresh,
    canaryDue: shouldRunAsyncWorkerCanary(checks, nowMs),
    staleQueuedCount: lastHeartbeat?.staleQueuedCount || 0,
    oldestQueuedAgeMs: lastHeartbeat?.oldestQueuedAgeMs ?? null,
    lastHeartbeatAt: lastHeartbeat?.startedAt || null,
    lastHeartbeatStatus: lastHeartbeat?.status || null,
    lastSelfHealAt: lastSelfHeal?.finishedAt || lastSelfHeal?.startedAt || null,
    lastSelfHealStatus: lastSelfHeal?.status || null,
    lastCanaryAt: lastCanary?.finishedAt || lastCanary?.startedAt || null,
    lastCanaryStatus: lastCanary?.status || null,
    lastCanaryLatencyMs: lastCanary?.canaryLatencyMs ?? null,
  };
};

export const insertAsyncWorkerHealthCheck = async (
  config: { url: string; serviceRoleKey: string },
  input: {
    checkType: AsyncWorkerHealthCheckType;
    status: AsyncWorkerHealthStatus;
    startedAt: string;
    finishedAt?: string | null;
    staleQueuedCount?: number;
    oldestQueuedAgeMs?: number | null;
    dispatchAttempted?: boolean;
    dispatchHttpStatus?: number | null;
    canaryLatencyMs?: number | null;
    failureCode?: string | null;
    failureMessage?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<boolean> => {
  const response = await serviceFetch(config, "/rest/v1/async_worker_health_checks", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      check_type: input.checkType,
      status: input.status,
      started_at: input.startedAt,
      finished_at: input.finishedAt || null,
      stale_queued_count: Math.max(0, Math.round(Number(input.staleQueuedCount || 0))),
      oldest_queued_age_ms: input.oldestQueuedAgeMs ?? null,
      dispatch_attempted: input.dispatchAttempted === true,
      dispatch_http_status: input.dispatchHttpStatus ?? null,
      canary_latency_ms: input.canaryLatencyMs ?? null,
      failure_code: clipText(input.failureCode, 120),
      failure_message: clipText(input.failureMessage),
      metadata: input.metadata || {},
    }),
  });
  return response.ok;
};

export const listRecentAsyncWorkerHealthChecks = async (
  config: { url: string; serviceRoleKey: string },
  limit = 25,
): Promise<AsyncWorkerHealthCheckRecord[]> => {
  const safeLimit = Math.max(1, Math.min(100, Math.round(limit)));
  const response = await serviceFetch(
    config,
    `/rest/v1/async_worker_health_checks?select=id,check_type,status,started_at,finished_at,stale_queued_count,oldest_queued_age_ms,dispatch_attempted,dispatch_http_status,canary_latency_ms,failure_code,failure_message,metadata,created_at&order=started_at.desc&limit=${safeLimit}`,
    {
      method: "GET",
    },
  );
  if (!response.ok) return [];
  const payload = await safeJsonParse(response);
  const rows = Array.isArray(payload) ? payload : [];
  return rows
    .map((row) => parseHealthCheckRecord(row))
    .filter((row): row is AsyncWorkerHealthCheckRecord => Boolean(row));
};

export const readStaleQueuedJobSnapshot = async (
  config: { url: string; serviceRoleKey: string },
  options?: { now?: Date; staleThresholdMs?: number },
): Promise<AsyncWorkerQueueSnapshot> => {
  const now = options?.now || new Date();
  const staleThresholdMs = Math.max(60_000, options?.staleThresholdMs || ASYNC_WORKER_STALE_QUEUE_MS);
  const nowIso = now.toISOString();
  const cutoffIso = new Date(now.getTime() - staleThresholdMs).toISOString();
  const response = await serviceFetch(
    config,
    `/rest/v1/trip_generation_jobs?state=eq.queued&run_after=lte.${encodeURIComponent(nowIso)}&updated_at=lte.${encodeURIComponent(cutoffIso)}&select=id,updated_at&order=updated_at.asc&limit=1`,
    {
      method: "GET",
      headers: {
        Prefer: "count=exact",
      },
    },
  );

  if (!response.ok) {
    const payload = await safeJsonParse(response);
    const errorMessage = asString(asObject(payload)?.message) || `Stale queue snapshot failed (${response.status}).`;
    return {
      staleQueuedCount: 0,
      oldestQueuedAgeMs: null,
      oldestQueuedUpdatedAt: null,
      errorMessage,
    };
  }

  const payload = await safeJsonParse(response);
  const rows = Array.isArray(payload) ? payload : [];
  const firstRow = asObject(rows[0]);
  const oldestQueuedUpdatedAt = asString(firstRow?.updated_at);
  const oldestQueuedMs = asIsoMs(oldestQueuedUpdatedAt);
  return {
    staleQueuedCount: parseContentRangeCount(response.headers.get("content-range")) || rows.length,
    oldestQueuedAgeMs: oldestQueuedMs === null ? null : Math.max(0, now.getTime() - oldestQueuedMs),
    oldestQueuedUpdatedAt,
    errorMessage: null,
  };
};

const resolveCanaryOwnerId = async (
  config: { url: string; serviceRoleKey: string },
): Promise<string | null> => {
  const explicit = asString(readEnv("AI_GENERATION_ASYNC_CANARY_OWNER_ID"));
  if (explicit) return explicit;

  const response = await serviceFetch(
    config,
    "/rest/v1/admin_user_roles?select=user_id&order=assigned_at.asc&limit=1",
    {
      method: "GET",
    },
  );
  if (!response.ok) return null;
  const payload = await safeJsonParse(response);
  const row = Array.isArray(payload) ? asObject(payload[0]) : null;
  return asString(row?.user_id);
};

export const cleanupStaleAsyncWorkerCanaries = async (
  config: { url: string; serviceRoleKey: string },
  now = new Date(),
): Promise<boolean> => {
  const cutoffIso = new Date(now.getTime() - ASYNC_WORKER_CANARY_CLEANUP_MS).toISOString();
  const response = await serviceFetch(
    config,
    `/rest/v1/trips?source_kind=eq.${encodeURIComponent(ASYNC_WORKER_CANARY_SOURCE_KIND)}&created_at=lte.${encodeURIComponent(cutoffIso)}`,
    {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal",
      },
    },
  );
  return response.ok;
};

export const createAsyncWorkerCanary = async (
  config: { url: string; serviceRoleKey: string },
  now = new Date(),
): Promise<{ canary: AsyncWorkerCanaryContext | null; errorCode?: string; errorMessage?: string }> => {
  const ownerId = await resolveCanaryOwnerId(config);
  if (!ownerId) {
    return {
      canary: null,
      errorCode: "WORKER_CANARY_OWNER_MISSING",
      errorMessage: "No admin owner is available for async worker canary rows.",
    };
  }

  const uuid = crypto.randomUUID();
  const tripId = `internal-canary-${uuid}`;
  const attemptId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const requestId = `async-worker-canary-${uuid}`;
  const startedAt = now.toISOString();

  const tripResponse = await serviceFetch(config, "/rest/v1/trips", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      id: tripId,
      owner_id: ownerId,
      title: "Async Worker Canary",
      status: "archived",
      archived_at: startedAt,
      source_kind: ASYNC_WORKER_CANARY_SOURCE_KIND,
      data: {
        canary: true,
        createdAt: startedAt,
      },
      view_settings: {},
    }),
  });
  if (!tripResponse.ok) {
    return {
      canary: null,
      errorCode: "WORKER_CANARY_TRIP_INSERT_FAILED",
      errorMessage: `Failed to insert canary trip (${tripResponse.status}).`,
    };
  }

  const attemptResponse = await serviceFetch(config, "/rest/v1/trip_generation_attempts", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      id: attemptId,
      trip_id: tripId,
      owner_id: ownerId,
      flow: "classic",
      source: ASYNC_WORKER_CANARY_SOURCE,
      state: "queued",
      request_id: requestId,
      started_at: startedAt,
      metadata: {
        canary: true,
      },
    }),
  });
  if (!attemptResponse.ok) {
    await deleteAsyncWorkerCanaryTrip(config, tripId);
    return {
      canary: null,
      errorCode: "WORKER_CANARY_ATTEMPT_INSERT_FAILED",
      errorMessage: `Failed to insert canary attempt (${attemptResponse.status}).`,
    };
  }

  const jobResponse = await serviceFetch(config, "/rest/v1/trip_generation_jobs", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      id: jobId,
      trip_id: tripId,
      owner_id: ownerId,
      attempt_id: attemptId,
      state: "queued",
      priority: 0,
      payload: {
        canary: true,
      },
      run_after: startedAt,
      max_retries: 0,
    }),
  });
  if (!jobResponse.ok) {
    await deleteAsyncWorkerCanaryTrip(config, tripId);
    return {
      canary: null,
      errorCode: "WORKER_CANARY_JOB_INSERT_FAILED",
      errorMessage: `Failed to insert canary job (${jobResponse.status}).`,
    };
  }

  return {
    canary: {
      tripId,
      attemptId,
      jobId,
      ownerId,
      requestId,
      startedAt,
    },
  };
};

export const readAsyncWorkerCanaryEvaluation = async (
  config: { url: string; serviceRoleKey: string },
  canary: AsyncWorkerCanaryContext,
  now = new Date(),
): Promise<AsyncWorkerCanaryEvaluation> => {
  const response = await serviceFetch(
    config,
    `/rest/v1/trip_generation_jobs?id=eq.${encodeURIComponent(canary.jobId)}&select=id,state,last_error_code,last_error_message,leased_by,updated_at,finished_at&limit=1`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    return {
      status: "failed",
      failureCode: "WORKER_CANARY_LOOKUP_FAILED",
      failureMessage: `Canary lookup failed (${response.status}).`,
      latencyMs: null,
      jobState: null,
      errorCode: null,
      errorMessage: null,
    };
  }

  const payload = await safeJsonParse(response);
  const row = Array.isArray(payload) ? asObject(payload[0]) : null;
  const jobState = asString(row?.state);
  const errorCode = asString(row?.last_error_code);
  const errorMessage = asString(row?.last_error_message);
  const latencyMs = Math.max(0, now.getTime() - (asIsoMs(canary.startedAt) || now.getTime()));

  if (jobState === "failed" && errorCode === "ASYNC_WORKER_PAYLOAD_INVALID") {
    return {
      status: "ok",
      failureCode: null,
      failureMessage: null,
      latencyMs,
      jobState,
      errorCode,
      errorMessage,
    };
  }

  if (jobState === "queued" || jobState === "leased") {
    return {
      status: "failed",
      failureCode: "WORKER_CANARY_NOT_TERMINAL",
      failureMessage: `Canary job remained ${jobState} after cron dispatch.`,
      latencyMs,
      jobState,
      errorCode,
      errorMessage,
    };
  }

  return {
    status: "failed",
    failureCode: "WORKER_CANARY_UNEXPECTED_RESULT",
    failureMessage: `Canary resolved with unexpected state ${jobState || "unknown"}.`,
    latencyMs,
    jobState,
    errorCode,
    errorMessage,
  };
};

export const deleteAsyncWorkerCanaryTrip = async (
  config: { url: string; serviceRoleKey: string },
  tripId: string,
): Promise<boolean> => {
  const response = await serviceFetch(
    config,
    `/rest/v1/trips?id=eq.${encodeURIComponent(tripId)}`,
    {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal",
      },
    },
  );
  return response.ok;
};
