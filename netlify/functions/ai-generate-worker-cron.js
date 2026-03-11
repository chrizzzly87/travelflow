import {
  cleanupStaleAsyncWorkerCanaries,
  createAsyncWorkerCanary,
  deleteAsyncWorkerCanaryTrip,
  getAsyncWorkerHealthConfig,
  insertAsyncWorkerHealthCheck,
  listRecentAsyncWorkerHealthChecks,
  readStaleQueuedJobSnapshot,
  shouldRunAsyncWorkerCanary,
  waitForAsyncWorkerCanaryEvaluation,
} from "../edge-lib/async-worker-health.ts";

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

const tryParseJson = (value) => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const jsonResponse = (statusCode, payload) => ({
  statusCode,
  headers: JSON_HEADERS,
  body: JSON.stringify(payload),
});

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
    const bodyText = await response.text();
    const parsed = tryParseJson(bodyText);
    return {
      statusCode: response.status,
      payload: parsed ?? {
        ok: response.ok,
        status: response.status,
        body: bodyText || null,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Background worker trigger failed";
    return {
      statusCode: 202,
      payload: {
        ok: true,
        accepted: false,
        error: message,
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

const extractDispatchAccepted = (invoked) => {
  if (invoked.statusCode < 200 || invoked.statusCode >= 300) return false;
  if (!invoked.payload || typeof invoked.payload !== "object") return false;
  if (invoked.payload.ok === false) return false;
  if (invoked.payload.accepted === false) return false;
  return true;
};

const summarizeDispatchFailure = (invoked) => {
  if (!invoked?.payload || typeof invoked.payload !== "object") {
    return {
      code: "WORKER_CRON_DISPATCH_FAILED",
      message: "Background worker dispatch failed.",
    };
  }
  const payload = invoked.payload;
  return {
    code: typeof payload.code === "string" && payload.code.trim()
      ? payload.code.trim()
      : "WORKER_CRON_DISPATCH_FAILED",
    message: typeof payload.error === "string" && payload.error.trim()
      ? payload.error.trim()
      : (typeof payload.details === "string" && payload.details.trim()
        ? payload.details.trim()
        : "Background worker dispatch failed."),
  };
};

const buildHeartbeatOutcome = (params) => {
  if (params.snapshotError) {
    return {
      status: "failed",
      failureCode: "WORKER_STALE_QUEUE_LOOKUP_FAILED",
      failureMessage: params.snapshotError,
    };
  }
  if (!params.dispatchAccepted) {
    const failure = summarizeDispatchFailure(params.invoked);
    return {
      status: "failed",
      failureCode: failure.code,
      failureMessage: failure.message,
    };
  }
  if (params.preDispatchStaleCount > 0) {
    return {
      status: "warning",
      failureCode: "WORKER_STALE_QUEUE_DETECTED",
      failureMessage: `Detected ${params.preDispatchStaleCount} stale queued job${params.preDispatchStaleCount === 1 ? "" : "s"} and re-kicked the worker.`,
    };
  }
  return {
    status: "ok",
    failureCode: null,
    failureMessage: null,
  };
};

const buildResponseStatus = (invoked, heartbeatStatus) => {
  if (heartbeatStatus === "failed") {
    return invoked.statusCode >= 400 ? invoked.statusCode : 500;
  }
  return invoked.statusCode;
};

export const config = {
  schedule: "*/1 * * * *",
};

export const handler = async () => {
  if (!isEnabled(process.env.AI_GENERATION_ASYNC_WORKER_ENABLED || "")) {
    return jsonResponse(200, {
      ok: true,
      skipped: true,
      reason: "worker_disabled",
    });
  }

  const adminKey = (process.env.TF_ADMIN_API_KEY || "").trim();
  const baseUrl = resolveBaseUrl();
  const healthConfig = getAsyncWorkerHealthConfig();
  if (!adminKey || !baseUrl || !healthConfig) {
    return jsonResponse(200, {
      ok: true,
      skipped: true,
      reason: "missing_configuration",
    });
  }

  const cronStartedAt = new Date();
  const cronStartedAtIso = cronStartedAt.toISOString();
  const workerLimitBase = resolveInteger(process.env.AI_GENERATION_ASYNC_WORKER_BATCH || "1", 1, 1, 5);
  const triggerTimeoutMs = resolveInteger(process.env.AI_GENERATION_ASYNC_TRIGGER_TIMEOUT_MS || "180000", 180_000, 5_000, 240_000);
  const canaryPollIntervalMs = resolveInteger(process.env.AI_GENERATION_ASYNC_CANARY_POLL_INTERVAL_MS || "1000", 1000, 0, 5000);
  const canaryMaxWaitMs = resolveInteger(process.env.AI_GENERATION_ASYNC_CANARY_MAX_WAIT_MS || "12000", 12_000, 0, 30_000);

  const recentChecks = await listRecentAsyncWorkerHealthChecks(healthConfig, 25);
  await cleanupStaleAsyncWorkerCanaries(healthConfig, cronStartedAt);

  const preDispatchSnapshot = await readStaleQueuedJobSnapshot(healthConfig, { now: cronStartedAt });
  const shouldScheduleCanary = !preDispatchSnapshot.errorMessage && shouldRunAsyncWorkerCanary(recentChecks, cronStartedAt.getTime());

  let canaryContext = null;
  let canaryCreateError = null;
  if (shouldScheduleCanary) {
    const canaryResult = await createAsyncWorkerCanary(healthConfig, cronStartedAt);
    canaryContext = canaryResult.canary;
    if (!canaryResult.canary) {
      canaryCreateError = {
        code: canaryResult.errorCode || "WORKER_CANARY_CREATE_FAILED",
        message: canaryResult.errorMessage || "Failed to create async worker canary rows.",
      };
    }
  }

  const dispatchLimit = Math.min(workerLimitBase + (canaryContext ? 1 : 0), 5);
  const invoked = await invokeBackgroundWorker({
    baseUrl,
    adminKey,
    limit: dispatchLimit,
    timeoutMs: triggerTimeoutMs,
  });
  const dispatchAccepted = extractDispatchAccepted(invoked);

  const postDispatchSnapshot = preDispatchSnapshot.staleQueuedCount > 0
    ? await readStaleQueuedJobSnapshot(healthConfig, { now: new Date() })
    : preDispatchSnapshot;

  const heartbeatOutcome = buildHeartbeatOutcome({
    snapshotError: preDispatchSnapshot.errorMessage,
    dispatchAccepted,
    invoked,
    preDispatchStaleCount: preDispatchSnapshot.staleQueuedCount,
  });
  const cronFinishedAtIso = new Date().toISOString();

  const heartbeatMetadata = {
    workerLimitBase,
    dispatchLimit,
    selfHealAttempted: preDispatchSnapshot.staleQueuedCount > 0,
    selfHealSucceeded: preDispatchSnapshot.staleQueuedCount > 0 ? dispatchAccepted : null,
    staleQueuedCountBefore: preDispatchSnapshot.staleQueuedCount,
    staleQueuedCountAfter: postDispatchSnapshot.staleQueuedCount,
    canaryScheduled: shouldScheduleCanary,
    canaryCreated: Boolean(canaryContext),
    canaryJobId: canaryContext?.jobId || null,
  };

  await insertAsyncWorkerHealthCheck(healthConfig, {
    checkType: "heartbeat",
    status: heartbeatOutcome.status,
    startedAt: cronStartedAtIso,
    finishedAt: cronFinishedAtIso,
    staleQueuedCount: preDispatchSnapshot.staleQueuedCount,
    oldestQueuedAgeMs: preDispatchSnapshot.oldestQueuedAgeMs,
    dispatchAttempted: true,
    dispatchHttpStatus: invoked.statusCode,
    failureCode: heartbeatOutcome.failureCode,
    failureMessage: heartbeatOutcome.failureMessage,
    metadata: heartbeatMetadata,
  });

  if (preDispatchSnapshot.staleQueuedCount > 0 || preDispatchSnapshot.errorMessage) {
    await insertAsyncWorkerHealthCheck(healthConfig, {
      checkType: "watchdog",
      status: heartbeatOutcome.status,
      startedAt: cronStartedAtIso,
      finishedAt: cronFinishedAtIso,
      staleQueuedCount: preDispatchSnapshot.staleQueuedCount,
      oldestQueuedAgeMs: preDispatchSnapshot.oldestQueuedAgeMs,
      dispatchAttempted: true,
      dispatchHttpStatus: invoked.statusCode,
      failureCode: heartbeatOutcome.failureCode,
      failureMessage: heartbeatOutcome.failureMessage,
      metadata: {
        ...heartbeatMetadata,
        preDispatchSnapshotError: preDispatchSnapshot.errorMessage || null,
        postDispatchSnapshotError: postDispatchSnapshot.errorMessage || null,
      },
    });
  }

  let canaryPayload = null;
  if (shouldScheduleCanary) {
    if (canaryCreateError) {
      canaryPayload = {
        status: "failed",
        code: canaryCreateError.code,
        error: canaryCreateError.message,
        latencyMs: null,
      };
      await insertAsyncWorkerHealthCheck(healthConfig, {
        checkType: "canary",
        status: "failed",
        startedAt: cronStartedAtIso,
        finishedAt: cronFinishedAtIso,
        failureCode: canaryCreateError.code,
        failureMessage: canaryCreateError.message,
        metadata: {
          dispatchLimit,
        },
      });
    } else if (canaryContext) {
      if (!dispatchAccepted) {
        const dispatchFailure = summarizeDispatchFailure(invoked);
        canaryPayload = {
          status: "failed",
          code: "WORKER_CANARY_DISPATCH_FAILED",
          error: dispatchFailure.message,
          latencyMs: null,
        };
        await insertAsyncWorkerHealthCheck(healthConfig, {
          checkType: "canary",
          status: "failed",
          startedAt: canaryContext.startedAt,
          finishedAt: cronFinishedAtIso,
          failureCode: "WORKER_CANARY_DISPATCH_FAILED",
          failureMessage: dispatchFailure.message,
          metadata: {
            tripId: canaryContext.tripId,
            attemptId: canaryContext.attemptId,
            jobId: canaryContext.jobId,
          },
        });
      } else {
        const evaluation = await waitForAsyncWorkerCanaryEvaluation(healthConfig, canaryContext, {
          maxWaitMs: canaryMaxWaitMs,
          pollIntervalMs: canaryPollIntervalMs,
        });
        const cleanedUp = evaluation.status === "ok"
          ? await deleteAsyncWorkerCanaryTrip(healthConfig, canaryContext.tripId)
          : false;
        canaryPayload = {
          status: evaluation.status,
          code: evaluation.failureCode || evaluation.errorCode || "ASYNC_WORKER_PAYLOAD_INVALID",
          error: evaluation.failureMessage || evaluation.errorMessage || null,
          latencyMs: evaluation.latencyMs,
        };
        await insertAsyncWorkerHealthCheck(healthConfig, {
          checkType: "canary",
          status: evaluation.status,
          startedAt: canaryContext.startedAt,
          finishedAt: cronFinishedAtIso,
          canaryLatencyMs: evaluation.latencyMs,
          failureCode: evaluation.failureCode,
          failureMessage: evaluation.failureMessage,
          metadata: {
            tripId: canaryContext.tripId,
            attemptId: canaryContext.attemptId,
            jobId: canaryContext.jobId,
            jobState: evaluation.jobState,
            errorCode: evaluation.errorCode,
            errorMessage: evaluation.errorMessage,
            canaryMaxWaitMs,
            canaryPollIntervalMs,
            cleanedUp,
          },
        });
      }
    }
  }

  return jsonResponse(buildResponseStatus(invoked, heartbeatOutcome.status), {
    ...invoked.payload,
    health: {
      status: heartbeatOutcome.status,
      staleQueuedCount: preDispatchSnapshot.staleQueuedCount,
      oldestQueuedAgeMs: preDispatchSnapshot.oldestQueuedAgeMs,
      selfHealAttempted: preDispatchSnapshot.staleQueuedCount > 0,
      selfHealSucceeded: preDispatchSnapshot.staleQueuedCount > 0 ? dispatchAccepted : null,
      postDispatchStaleQueuedCount: postDispatchSnapshot.staleQueuedCount,
      canary: canaryPayload,
    },
  });
};
