import type {
    ITrip,
    ITripAiMeta,
    TripGenerationAttemptSummary,
    TripGenerationFailureKind,
    TripGenerationFlow,
    TripGenerationInputSnapshot,
    TripGenerationState,
} from '../types';

export const GENERATION_ATTEMPT_HISTORY_LIMIT = 12;
export const TRIP_GENERATION_TIMEOUT_MS = 60_000;
export const TRIP_GENERATION_STALE_GRACE_MS = 15_000;

export interface TripGenerationErrorLike {
    code?: string | null;
    status?: number | null;
    details?: string | null;
    message?: string | null;
    requestId?: string | null;
    durationMs?: number | null;
    provider?: string | null;
    model?: string | null;
    providerModel?: string | null;
    failureKind?: TripGenerationFailureKind | null;
    aborted?: boolean;
    requestPayload?: Record<string, unknown> | null;
    security?: Record<string, unknown> | null;
}

export interface TripGenerationStartParams {
    flow: TripGenerationFlow;
    source: string;
    inputSnapshot: TripGenerationInputSnapshot;
    provider: string;
    model: string;
    providerModel?: string | null;
    requestId?: string | null;
    metadata?: Record<string, unknown> | null;
    startedAt?: string;
    attemptId?: string;
    state?: 'queued' | 'running';
    isRetry?: boolean;
}

export interface TripGenerationSuccessParams {
    flow: TripGenerationFlow;
    source: string;
    provider: string;
    model: string;
    providerModel?: string | null;
    requestId?: string | null;
    durationMs?: number | null;
    statusCode?: number | null;
    finishedAt?: string;
    metadata?: Record<string, unknown> | null;
    attemptId?: string | null;
}

export interface TripGenerationFailureParams {
    flow: TripGenerationFlow;
    source: string;
    error: unknown;
    provider?: string | null;
    model?: string | null;
    providerModel?: string | null;
    requestId?: string | null;
    durationMs?: number | null;
    statusCode?: number | null;
    finishedAt?: string;
    metadata?: Record<string, unknown> | null;
    attemptId?: string | null;
}

const FALLBACK_PROVIDER = 'unknown';
const FALLBACK_MODEL = 'unknown';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asText = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const asNumber = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
};

const toIsoMs = (value: string | null | undefined): number | null => {
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const getNowIso = (): string => new Date().toISOString();

const randomUuid = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const toErrorLike = (error: unknown): TripGenerationErrorLike => {
    if (!error) return {};
    if (error instanceof Error) {
        const typed = error as Error & TripGenerationErrorLike;
        return {
            code: typed.code || null,
            status: asNumber(typed.status),
            details: typed.details || null,
            message: typed.message || null,
            requestId: typed.requestId || null,
            durationMs: asNumber(typed.durationMs),
            provider: typed.provider || null,
            model: typed.model || null,
            providerModel: typed.providerModel || null,
            failureKind: typed.failureKind || null,
            aborted: typed.aborted === true,
            requestPayload: asRecord((typed as unknown as Record<string, unknown>).requestPayload),
            security: asRecord((typed as unknown as Record<string, unknown>).security),
        };
    }
    if (isRecord(error)) {
        return {
            code: asText(error.code),
            status: asNumber(error.status),
            details: asText(error.details),
            message: asText(error.message),
            requestId: asText(error.requestId),
            durationMs: asNumber(error.durationMs),
            provider: asText(error.provider),
            model: asText(error.model),
            providerModel: asText(error.providerModel),
            failureKind: asText(error.failureKind) as TripGenerationFailureKind | null,
            aborted: error.aborted === true,
            requestPayload: asRecord(error.requestPayload),
            security: asRecord(error.security),
        };
    }
    return {};
};

const classifyByCodeOrMessage = (codeRaw: string | null, messageRaw: string | null): TripGenerationFailureKind => {
    const code = (codeRaw || '').toLowerCase();
    const message = (messageRaw || '').toLowerCase();
    if (!code && !message) return 'unknown';

    if (code.includes('timeout') || message.includes('timed out') || message.includes('timeout')) {
        return 'timeout';
    }
    if (code.includes('abort') || message.includes('abort') || message.includes('beforeunload') || message.includes('tab close')) {
        return 'abort';
    }
    if (
        code.includes('parse')
        || code.includes('quality')
        || code.includes('security')
        || code.includes('prompt')
        || message.includes('quality')
        || message.includes('invalid json')
        || message.includes('processed safely')
    ) {
        return 'quality';
    }
    if (
        code.includes('provider')
        || code.includes('model_not_allowed')
        || code.includes('key_missing')
        || code.includes('request_failed')
    ) {
        return 'provider';
    }
    if (code.includes('network') || message.includes('network') || message.includes('failed to fetch')) {
        return 'network';
    }
    return 'unknown';
};

export const classifyTripGenerationFailure = (
    error: unknown,
): {
    kind: TripGenerationFailureKind;
    code: string | null;
    message: string;
    statusCode: number | null;
} => {
    const typed = toErrorLike(error);
    const code = typed.code || null;
    const statusCode = asNumber(typed.status);
    const message = typed.message
        || typed.details
        || 'Trip generation failed unexpectedly.';

    let kind: TripGenerationFailureKind;
    if (typed.failureKind) {
        kind = typed.failureKind;
    } else if (typed.aborted) {
        kind = 'abort';
    } else if (statusCode === 408 || statusCode === 504) {
        kind = 'timeout';
    } else {
        kind = classifyByCodeOrMessage(code, message);
    }

    return {
        kind,
        code,
        message,
        statusCode,
    };
};

const getGenerationAttemptHistory = (trip: ITrip): TripGenerationAttemptSummary[] => {
    const attempts = trip.aiMeta?.generation?.attempts;
    if (!Array.isArray(attempts)) return [];
    return attempts.filter((entry): entry is TripGenerationAttemptSummary => Boolean(entry && typeof entry === 'object'));
};

const ensureAiMeta = (trip: ITrip, provider?: string | null, model?: string | null): ITripAiMeta => {
    const nowIso = getNowIso();
    const existing = trip.aiMeta;
    return {
        provider: provider || existing?.provider || FALLBACK_PROVIDER,
        model: model || existing?.model || FALLBACK_MODEL,
        generatedAt: existing?.generatedAt || nowIso,
        benchmarkRunId: existing?.benchmarkRunId ?? null,
        benchmarkSessionId: existing?.benchmarkSessionId ?? null,
        generation: existing?.generation,
    };
};

const withBoundedAttempts = (attempts: TripGenerationAttemptSummary[]): TripGenerationAttemptSummary[] => {
    if (attempts.length <= GENERATION_ATTEMPT_HISTORY_LIMIT) return attempts;
    return attempts.slice(attempts.length - GENERATION_ATTEMPT_HISTORY_LIMIT);
};

const updateAttemptById = (
    attempts: TripGenerationAttemptSummary[],
    attemptId: string | null | undefined,
    updater: (attempt: TripGenerationAttemptSummary) => TripGenerationAttemptSummary,
): TripGenerationAttemptSummary[] => {
    if (!attemptId) {
        if (attempts.length === 0) return attempts;
        const lastIndex = attempts.length - 1;
        return attempts.map((attempt, index) => (index === lastIndex ? updater(attempt) : attempt));
    }
    return attempts.map((attempt) => (attempt.id === attemptId ? updater(attempt) : attempt));
};

const getLatestAttempt = (attempts: TripGenerationAttemptSummary[]): TripGenerationAttemptSummary | null => {
    if (attempts.length === 0) return null;
    return attempts[attempts.length - 1];
};

const dedupeAttemptsByIdKeepingLatest = (
    attempts: TripGenerationAttemptSummary[],
): TripGenerationAttemptSummary[] => {
    if (attempts.length <= 1) return attempts;
    const deduped: TripGenerationAttemptSummary[] = [];
    attempts.forEach((attempt) => {
        const existingIndex = deduped.findIndex((entry) => entry.id === attempt.id);
        if (existingIndex >= 0) {
            deduped.splice(existingIndex, 1);
        }
        deduped.push(attempt);
    });
    return deduped;
};

const mergeAttemptMetadata = (
    ...values: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> | null => {
    const merged: Record<string, unknown> = {};
    values.forEach((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return;
        Object.assign(merged, value);
    });
    return Object.keys(merged).length > 0 ? merged : null;
};

const LEGACY_FAILED_PLACEHOLDER_PREFIX = 'loading-error-';
const ACTIVE_LOADING_PLACEHOLDER_PREFIX = 'loading-city-';
const QUEUE_LOADING_PLACEHOLDER_PREFIX = 'queue-loading-city-';
const ACTIVE_LOADING_DESCRIPTION = 'ai is generating this part of your itinerary.';
const QUEUE_LOADING_DESCRIPTION = 'queued generation is preparing this trip.';

const isLegacyFailedGenerationPlaceholderTrip = (trip: ITrip): boolean => {
    if (trip.aiMeta?.generation?.state) return false;
    return trip.items.some((item) => (
        item.type === 'city'
        && item.loading !== true
        && typeof item.id === 'string'
        && item.id.startsWith(LEGACY_FAILED_PLACEHOLDER_PREFIX)
    ));
};

const isTripGenerationPlaceholderItem = (item: ITrip['items'][number]): boolean => {
    if (typeof item.id === 'string') {
        if (item.id.startsWith(LEGACY_FAILED_PLACEHOLDER_PREFIX)) return true;
        if (item.id.startsWith(ACTIVE_LOADING_PLACEHOLDER_PREFIX)) return true;
        if (item.id.startsWith(QUEUE_LOADING_PLACEHOLDER_PREFIX)) return true;
    }
    if (item.type !== 'city') return false;

    const normalizedTitle = (item.title || '').trim().toLowerCase();
    const normalizedDescription = (item.description || '').trim().toLowerCase();
    if (normalizedTitle.startsWith('loading stop ')) return true;
    if (normalizedDescription === ACTIVE_LOADING_DESCRIPTION) return true;
    if (normalizedDescription === QUEUE_LOADING_DESCRIPTION) return true;
    return false;
};

const hasOnlyTripGenerationPlaceholderItems = (trip: ITrip): boolean => (
    trip.items.length > 0 && trip.items.every((item) => isTripGenerationPlaceholderItem(item))
);

const hasMaterializedTripGenerationContent = (trip: ITrip): boolean => (
    trip.items.some((item) => !item.loading && !isTripGenerationPlaceholderItem(item))
);

const isAsyncWorkerOrchestration = (
    metadata: Record<string, unknown> | null | undefined,
): boolean => {
    if (!metadata) return false;
    const orchestration = asText(metadata.orchestration);
    return orchestration === 'async_worker'
        || orchestration === 'async_worker_enqueue'
        || orchestration === 'queue_claim_async_worker';
};

export const createTripGenerationAttemptId = (): string => randomUuid();
export const createTripGenerationRequestId = (): string => randomUuid();

export const createTripGenerationInputSnapshot = (params: {
    flow: TripGenerationFlow;
    destinationLabel?: string;
    startDate?: string;
    endDate?: string;
    payload: Record<string, unknown>;
}): TripGenerationInputSnapshot => {
    return {
        flow: params.flow,
        destinationLabel: params.destinationLabel,
        startDate: params.startDate,
        endDate: params.endDate,
        payload: params.payload,
        createdAt: getNowIso(),
    };
};

export const getTripGenerationState = (trip: ITrip, nowMs = Date.now()): TripGenerationState => {
    const explicit = trip.aiMeta?.generation?.state;
    if (explicit === 'queued' || explicit === 'running' || explicit === 'failed' || explicit === 'succeeded') {
        const latestAttempt = trip.aiMeta?.generation?.latestAttempt || getLatestAttempt(getGenerationAttemptHistory(trip));
        const latestMetadata = asRecord(latestAttempt?.metadata);
        const isAsyncAttempt = isAsyncWorkerOrchestration(latestMetadata);
        const latestAttemptStartedAtMs = toIsoMs(latestAttempt?.startedAt);
        const lastSucceededAtMs = toIsoMs(trip.aiMeta?.generation?.lastSucceededAt);
        const generatedAtMs = toIsoMs(trip.aiMeta?.generatedAt);
        const hasLoadingItems = trip.items.some((item) => item.loading);
        const hasMaterializedContent = hasMaterializedTripGenerationContent(trip);

        if ((explicit === 'queued' || explicit === 'running') && !isAsyncAttempt && isTripGenerationStale(trip, TRIP_GENERATION_TIMEOUT_MS, nowMs)) {
            return 'failed';
        }
        if ((explicit === 'queued' || explicit === 'running') && !hasLoadingItems && hasMaterializedContent) {
            // Current async generation applies itinerary content atomically rather than
            // streaming partial chunks, so real non-placeholder content with no loading
            // markers is enough to treat stale in-flight metadata as terminal success.
            const retryRequestedAtMs = toIsoMs(trip.aiMeta?.generation?.retryRequestedAt);
            const retryCount = Number(trip.aiMeta?.generation?.retryCount || 0);
            const hasExplicitRetryIntent = retryCount > 0 || typeof retryRequestedAtMs === 'number';
            const attemptIsNewerThanVisibleSuccess = hasExplicitRetryIntent && typeof latestAttemptStartedAtMs === 'number' && (
                (typeof lastSucceededAtMs === 'number' && latestAttemptStartedAtMs > lastSucceededAtMs)
                || (typeof generatedAtMs === 'number' && latestAttemptStartedAtMs > generatedAtMs)
            );
            if (attemptIsNewerThanVisibleSuccess) {
                return explicit;
            }
            return 'succeeded';
        }
        return explicit;
    }
    if (trip.items.some((item) => item.loading)) return 'running';
    if (hasOnlyTripGenerationPlaceholderItems(trip)) return 'failed';
    if (isLegacyFailedGenerationPlaceholderTrip(trip)) return 'failed';
    return 'succeeded';
};

export const getTripGenerationElapsedMs = (trip: ITrip, nowMs = Date.now()): number | null => {
    const state = trip.aiMeta?.generation?.state;
    if (state !== 'running' && state !== 'queued') return null;
    const latestAttempt = getLatestTripGenerationAttempt(trip);
    if (!latestAttempt?.startedAt || latestAttempt.finishedAt) return null;
    const startedAtMs = toIsoMs(latestAttempt.startedAt);
    if (startedAtMs === null) return null;
    return Math.max(0, nowMs - startedAtMs);
};

export const isTripGenerationStale = (
    trip: ITrip,
    timeoutMs = TRIP_GENERATION_TIMEOUT_MS,
    nowMs = Date.now(),
): boolean => {
    const elapsedMs = getTripGenerationElapsedMs(trip, nowMs);
    if (elapsedMs === null) return false;
    return elapsedMs >= (timeoutMs + TRIP_GENERATION_STALE_GRACE_MS);
};

export const getTripGenerationAttempts = (trip: ITrip): TripGenerationAttemptSummary[] => getGenerationAttemptHistory(trip);

export const getLatestTripGenerationAttempt = (trip: ITrip): TripGenerationAttemptSummary | null => {
    return trip.aiMeta?.generation?.latestAttempt || getLatestAttempt(getGenerationAttemptHistory(trip));
};

export const withLatestTripGenerationAttemptId = (
    trip: ITrip,
    canonicalAttemptId: string | null | undefined,
): ITrip => {
    const nextAttemptId = (canonicalAttemptId || '').trim();
    if (!nextAttemptId) return trip;
    const generation = trip.aiMeta?.generation;
    if (!generation) return trip;

    const attempts = getGenerationAttemptHistory(trip);
    if (attempts.length === 0) return trip;
    const latestIndex = attempts.length - 1;
    const latestAttempt = attempts[latestIndex];
    if (!latestAttempt || latestAttempt.id === nextAttemptId) return trip;

    const rewrittenAttempts = attempts.map((attempt, index) => (
        index === latestIndex ? { ...attempt, id: nextAttemptId } : attempt
    ));
    const dedupedAttempts = withBoundedAttempts(dedupeAttemptsByIdKeepingLatest(rewrittenAttempts));
    const nextLatestAttempt = getLatestAttempt(dedupedAttempts);
    if (!nextLatestAttempt) return trip;

    return {
        ...trip,
        aiMeta: {
            ...(trip.aiMeta || ensureAiMeta(trip)),
            generation: {
                ...generation,
                attempts: dedupedAttempts,
                latestAttempt: nextLatestAttempt,
            },
        },
        updatedAt: Date.now(),
    };
};

export const getTripGenerationAttemptDisplayState = (
    attempt: TripGenerationAttemptSummary | null | undefined,
    nowMs = Date.now(),
    timeoutMs = TRIP_GENERATION_TIMEOUT_MS,
): TripGenerationState => {
    if (!attempt) return 'succeeded';
    if (attempt.state === 'succeeded' || attempt.state === 'failed') return attempt.state;
    if (attempt.finishedAt) return attempt.state;
    const startedAtMs = toIsoMs(attempt.startedAt);
    if (startedAtMs === null) return attempt.state;
    const elapsedMs = nowMs - startedAtMs;
    if (elapsedMs >= (timeoutMs + TRIP_GENERATION_STALE_GRACE_MS)) {
        return 'failed';
    }
    return attempt.state;
};

const normalizeAttemptIdentityPart = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const getTripGenerationAttemptIdentityKey = (
    attempt: TripGenerationAttemptSummary,
    fallbackIndex: number,
): string => {
    const requestId = normalizeAttemptIdentityPart(attempt.requestId);
    if (requestId) return `request:${requestId}`;
    const id = normalizeAttemptIdentityPart(attempt.id);
    if (id) return `id:${id}`;
    const flow = normalizeAttemptIdentityPart(attempt.flow);
    const source = normalizeAttemptIdentityPart(attempt.source);
    const startedAt = normalizeAttemptIdentityPart(attempt.startedAt);
    if (flow && source && startedAt) {
        return `flow:${flow}:source:${source}:started:${startedAt}`;
    }
    return `fallback:${fallbackIndex}`;
};

const getAttemptDetailScore = (attempt: TripGenerationAttemptSummary): number => {
    let score = 0;
    if (attempt.requestId) score += 1;
    if (attempt.provider) score += 1;
    if (attempt.model) score += 1;
    if (attempt.providerModel) score += 1;
    if (typeof attempt.statusCode === 'number') score += 1;
    if (typeof attempt.durationMs === 'number') score += 1;
    if (attempt.failureKind) score += 2;
    if (attempt.errorCode) score += 2;
    if (attempt.errorMessage) score += 2;
    if (attempt.finishedAt) score += 1;
    if (attempt.metadata && Object.keys(attempt.metadata).length > 0) score += 2;
    return score;
};

const choosePreferredAttemptForDisplay = (
    left: TripGenerationAttemptSummary,
    right: TripGenerationAttemptSummary,
    nowMs: number,
    timeoutMs: number,
): TripGenerationAttemptSummary => {
    const leftDisplayState = getTripGenerationAttemptDisplayState(left, nowMs, timeoutMs);
    const rightDisplayState = getTripGenerationAttemptDisplayState(right, nowMs, timeoutMs);
    const leftTerminal = leftDisplayState === 'failed' || leftDisplayState === 'succeeded';
    const rightTerminal = rightDisplayState === 'failed' || rightDisplayState === 'succeeded';
    if (leftTerminal !== rightTerminal) return leftTerminal ? left : right;

    const leftFinished = Boolean(left.finishedAt);
    const rightFinished = Boolean(right.finishedAt);
    if (leftFinished !== rightFinished) return leftFinished ? left : right;

    const leftDetailScore = getAttemptDetailScore(left);
    const rightDetailScore = getAttemptDetailScore(right);
    if (leftDetailScore !== rightDetailScore) return leftDetailScore > rightDetailScore ? left : right;

    const leftFinishedAtMs = toIsoMs(left.finishedAt);
    const rightFinishedAtMs = toIsoMs(right.finishedAt);
    if (leftFinishedAtMs !== rightFinishedAtMs) {
        return (leftFinishedAtMs ?? -1) >= (rightFinishedAtMs ?? -1) ? left : right;
    }

    const leftStartedAtMs = toIsoMs(left.startedAt);
    const rightStartedAtMs = toIsoMs(right.startedAt);
    if (leftStartedAtMs !== rightStartedAtMs) {
        return (leftStartedAtMs ?? -1) >= (rightStartedAtMs ?? -1) ? left : right;
    }

    return left;
};

const mergeAttemptForDisplay = (
    preferred: TripGenerationAttemptSummary,
    fallback: TripGenerationAttemptSummary,
): TripGenerationAttemptSummary => {
    return {
        id: preferred.id || fallback.id,
        flow: preferred.flow || fallback.flow,
        source: preferred.source || fallback.source,
        state: preferred.state,
        startedAt: preferred.startedAt || fallback.startedAt || getNowIso(),
        finishedAt: preferred.finishedAt ?? fallback.finishedAt ?? null,
        durationMs: preferred.durationMs ?? fallback.durationMs ?? null,
        requestId: preferred.requestId || fallback.requestId || null,
        provider: preferred.provider || fallback.provider || null,
        model: preferred.model || fallback.model || null,
        providerModel: preferred.providerModel || fallback.providerModel || null,
        statusCode: preferred.statusCode ?? fallback.statusCode ?? null,
        failureKind: preferred.failureKind || fallback.failureKind || null,
        errorCode: preferred.errorCode || fallback.errorCode || null,
        errorMessage: preferred.errorMessage || fallback.errorMessage || null,
        metadata: mergeAttemptMetadata(fallback.metadata, preferred.metadata),
    };
};

export const normalizeTripGenerationAttemptsForDisplay = (
    attempts: Array<TripGenerationAttemptSummary | null | undefined>,
    options?: {
        nowMs?: number;
        timeoutMs?: number;
        limit?: number;
    },
): TripGenerationAttemptSummary[] => {
    const nowMs = options?.nowMs ?? Date.now();
    const timeoutMs = options?.timeoutMs ?? TRIP_GENERATION_TIMEOUT_MS;
    const limit = Math.max(1, Math.round(options?.limit ?? GENERATION_ATTEMPT_HISTORY_LIMIT));
    const mergedByIdentity = new Map<string, TripGenerationAttemptSummary>();

    attempts.forEach((attempt, index) => {
        if (!attempt) return;
        const identity = getTripGenerationAttemptIdentityKey(attempt, index);
        const existing = mergedByIdentity.get(identity);
        if (!existing) {
            mergedByIdentity.set(identity, attempt);
            return;
        }
        const preferred = choosePreferredAttemptForDisplay(existing, attempt, nowMs, timeoutMs);
        const fallback = preferred === existing ? attempt : existing;
        mergedByIdentity.set(identity, mergeAttemptForDisplay(preferred, fallback));
    });

    return Array.from(mergedByIdentity.values())
        .map((attempt) => ({
            ...attempt,
            state: getTripGenerationAttemptDisplayState(attempt, nowMs, timeoutMs),
        }))
        .sort((left, right) => {
            const rightStarted = toIsoMs(right.startedAt) ?? 0;
            const leftStarted = toIsoMs(left.startedAt) ?? 0;
            if (rightStarted !== leftStarted) return rightStarted - leftStarted;
            const rightFinished = toIsoMs(right.finishedAt) ?? 0;
            const leftFinished = toIsoMs(left.finishedAt) ?? 0;
            return rightFinished - leftFinished;
        })
        .slice(0, limit);
};

export const isTripGenerationFailed = (trip: ITrip, nowMs = Date.now()): boolean => getTripGenerationState(trip, nowMs) === 'failed';
export const isTripGenerationRunning = (trip: ITrip, nowMs = Date.now()): boolean => getTripGenerationState(trip, nowMs) === 'running';

export const markTripGenerationRunning = (trip: ITrip, params: TripGenerationStartParams): ITrip => {
    const startedAt = params.startedAt || getNowIso();
    const attempt: TripGenerationAttemptSummary = {
        id: params.attemptId || createTripGenerationAttemptId(),
        flow: params.flow,
        source: params.source,
        state: params.state || 'running',
        startedAt,
        requestId: params.requestId || null,
        provider: params.provider,
        model: params.model,
        providerModel: params.providerModel || null,
        metadata: params.metadata || null,
    };

    const existingAttempts = getGenerationAttemptHistory(trip);
    const attempts = withBoundedAttempts([...existingAttempts, attempt]);
    const latestAttempt = getLatestAttempt(attempts);
    const currentRetryCount = Math.max(0, Number(trip.aiMeta?.generation?.retryCount || 0));
    const retryCount = params.isRetry ? currentRetryCount + 1 : currentRetryCount;

    const aiMeta = ensureAiMeta(trip, params.provider, params.model);
    return {
        ...trip,
        aiMeta: {
            ...aiMeta,
            provider: params.provider,
            model: params.model,
            generation: {
                state: params.state || 'running',
                latestAttempt,
                attempts,
                inputSnapshot: params.inputSnapshot,
                retryCount,
                retryRequestedAt: params.isRetry ? startedAt : aiMeta.generation?.retryRequestedAt || null,
                lastSucceededAt: aiMeta.generation?.lastSucceededAt || null,
                lastFailedAt: aiMeta.generation?.lastFailedAt || null,
            },
        },
        updatedAt: Date.now(),
    };
};

export const markTripGenerationSucceeded = (trip: ITrip, params: TripGenerationSuccessParams): ITrip => {
    const finishedAt = params.finishedAt || getNowIso();
    const existingAttempts = getGenerationAttemptHistory(trip);

    const attempts = withBoundedAttempts(updateAttemptById(existingAttempts, params.attemptId, (attempt) => {
        const startedMs = Date.parse(attempt.startedAt);
        const finishedMs = Date.parse(finishedAt);
        const durationMs = params.durationMs ?? (Number.isFinite(startedMs) && Number.isFinite(finishedMs)
            ? Math.max(0, finishedMs - startedMs)
            : null);
        return {
            ...attempt,
            state: 'succeeded',
            requestId: params.requestId || attempt.requestId || null,
            provider: params.provider || attempt.provider || null,
            model: params.model || attempt.model || null,
            providerModel: params.providerModel || attempt.providerModel || null,
            finishedAt,
            durationMs,
            statusCode: params.statusCode ?? attempt.statusCode ?? null,
            failureKind: null,
            errorCode: null,
            errorMessage: null,
            metadata: mergeAttemptMetadata(attempt.metadata, params.metadata),
        };
    }));

    const latestAttempt = getLatestAttempt(attempts);
    const aiMeta = ensureAiMeta(trip, params.provider, params.model);

    return {
        ...trip,
        aiMeta: {
            ...aiMeta,
            provider: params.provider,
            model: params.model,
            generatedAt: finishedAt,
            generation: {
                state: 'succeeded',
                latestAttempt,
                attempts,
                inputSnapshot: aiMeta.generation?.inputSnapshot || null,
                retryCount: aiMeta.generation?.retryCount || 0,
                retryRequestedAt: aiMeta.generation?.retryRequestedAt || null,
                lastSucceededAt: finishedAt,
                lastFailedAt: aiMeta.generation?.lastFailedAt || null,
            },
        },
        updatedAt: Date.now(),
    };
};

export const markTripGenerationFailed = (trip: ITrip, params: TripGenerationFailureParams): ITrip => {
    const finishedAt = params.finishedAt || getNowIso();
    const classification = classifyTripGenerationFailure(params.error);
    const typedError = toErrorLike(params.error);
    const nextItems = trip.items.some((item) => item.loading)
        ? trip.items.map((item) => (
            item.loading ? { ...item, loading: false } : item
        ))
        : trip.items;

    const existingAttempts = getGenerationAttemptHistory(trip);
    const fallbackProvider = params.provider || typedError.provider || trip.aiMeta?.provider || FALLBACK_PROVIDER;
    const fallbackModel = params.model || typedError.model || trip.aiMeta?.model || FALLBACK_MODEL;
    const shouldCreateFailedAttempt = params.attemptId
        ? !existingAttempts.some((attempt) => attempt.id === params.attemptId)
        : existingAttempts.length === 0;
    const attempts = shouldCreateFailedAttempt
        ? withBoundedAttempts([
            ...existingAttempts,
            {
                id: params.attemptId || createTripGenerationAttemptId(),
                flow: params.flow,
                source: params.source,
                state: 'failed',
                startedAt: finishedAt,
                finishedAt,
                durationMs: params.durationMs ?? typedError.durationMs ?? null,
                requestId: params.requestId || typedError.requestId || null,
                provider: fallbackProvider,
                model: fallbackModel,
                providerModel: params.providerModel || typedError.providerModel || null,
                statusCode: params.statusCode ?? classification.statusCode ?? null,
                failureKind: classification.kind,
                errorCode: classification.code,
                errorMessage: classification.message,
                metadata: mergeAttemptMetadata(
                    null,
                    params.metadata,
                    typedError.details ? { details: typedError.details } : null,
                    typedError.security ? { security: typedError.security } : null,
                    typedError.requestPayload ? { requestPayload: typedError.requestPayload } : null,
                ),
            },
        ])
        : withBoundedAttempts(updateAttemptById(existingAttempts, params.attemptId, (attempt) => {
            const startedMs = Date.parse(attempt.startedAt);
            const finishedMs = Date.parse(finishedAt);
            const durationMs = params.durationMs
                ?? typedError.durationMs
                ?? (Number.isFinite(startedMs) && Number.isFinite(finishedMs)
                    ? Math.max(0, finishedMs - startedMs)
                    : null);
            return {
                ...attempt,
                state: 'failed',
                requestId: params.requestId || typedError.requestId || attempt.requestId || null,
                provider: params.provider || typedError.provider || attempt.provider || fallbackProvider,
                model: params.model || typedError.model || attempt.model || fallbackModel,
                providerModel: params.providerModel || typedError.providerModel || attempt.providerModel || null,
                finishedAt,
                durationMs,
                statusCode: params.statusCode ?? classification.statusCode ?? attempt.statusCode ?? null,
                failureKind: classification.kind,
                errorCode: classification.code,
                errorMessage: classification.message,
                metadata: mergeAttemptMetadata(
                    attempt.metadata,
                    params.metadata,
                    typedError.details ? { details: typedError.details } : null,
                    typedError.security ? { security: typedError.security } : null,
                    typedError.requestPayload ? { requestPayload: typedError.requestPayload } : null,
                ),
            };
        }));
    const latestAttempt = getLatestAttempt(attempts);
    const aiMeta = ensureAiMeta(trip, fallbackProvider, fallbackModel);

    return {
        ...trip,
        items: nextItems,
        aiMeta: {
            ...aiMeta,
            provider: fallbackProvider,
            model: fallbackModel,
            generation: {
                state: 'failed',
                latestAttempt,
                attempts,
                inputSnapshot: aiMeta.generation?.inputSnapshot || null,
                retryCount: aiMeta.generation?.retryCount || 0,
                retryRequestedAt: aiMeta.generation?.retryRequestedAt || null,
                lastSucceededAt: aiMeta.generation?.lastSucceededAt || null,
                lastFailedAt: finishedAt,
            },
        },
        updatedAt: Date.now(),
    };
};

export const mergeGeneratedTripIntoExisting = (existingTrip: ITrip, generatedTrip: ITrip): ITrip => {
    return {
        ...generatedTrip,
        id: existingTrip.id,
        createdAt: existingTrip.createdAt,
        updatedAt: Date.now(),
        isFavorite: existingTrip.isFavorite,
        isPinned: existingTrip.isPinned,
        pinnedAt: existingTrip.pinnedAt,
        showOnPublicProfile: existingTrip.showOnPublicProfile,
        status: existingTrip.status || 'active',
        tripExpiresAt: existingTrip.tripExpiresAt ?? null,
        sourceKind: existingTrip.sourceKind || generatedTrip.sourceKind || 'created',
        aiMeta: {
            ...(generatedTrip.aiMeta || existingTrip.aiMeta || {
                provider: FALLBACK_PROVIDER,
                model: FALLBACK_MODEL,
                generatedAt: getNowIso(),
            }),
            generation: existingTrip.aiMeta?.generation,
        },
    };
};

export const getTripGenerationStateLabel = (state: TripGenerationState): string => {
    if (state === 'failed') return 'failed';
    if (state === 'running') return 'running';
    if (state === 'queued') return 'queued';
    return 'succeeded';
};

export const getTripGenerationStateTone = (
    state: TripGenerationState,
): 'neutral' | 'warning' | 'danger' | 'success' => {
    if (state === 'failed') return 'danger';
    if (state === 'running' || state === 'queued') return 'warning';
    return 'success';
};
