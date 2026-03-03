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
    if (code.includes('parse') || code.includes('quality') || message.includes('quality') || message.includes('invalid json')) {
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

export const getTripGenerationState = (trip: ITrip): TripGenerationState => {
    const explicit = trip.aiMeta?.generation?.state;
    if (explicit === 'queued' || explicit === 'running' || explicit === 'failed' || explicit === 'succeeded') {
        return explicit;
    }
    if (trip.items.some((item) => item.loading)) return 'running';
    return 'succeeded';
};

export const getTripGenerationAttempts = (trip: ITrip): TripGenerationAttemptSummary[] => getGenerationAttemptHistory(trip);

export const getLatestTripGenerationAttempt = (trip: ITrip): TripGenerationAttemptSummary | null => {
    return trip.aiMeta?.generation?.latestAttempt || getLatestAttempt(getGenerationAttemptHistory(trip));
};

export const isTripGenerationFailed = (trip: ITrip): boolean => getTripGenerationState(trip) === 'failed';
export const isTripGenerationRunning = (trip: ITrip): boolean => getTripGenerationState(trip) === 'running';

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
            metadata: params.metadata || attempt.metadata || null,
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

    const existingAttempts = getGenerationAttemptHistory(trip);
    const attempts = withBoundedAttempts(updateAttemptById(existingAttempts, params.attemptId, (attempt) => {
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
            provider: params.provider || typedError.provider || attempt.provider || null,
            model: params.model || typedError.model || attempt.model || null,
            providerModel: params.providerModel || typedError.providerModel || attempt.providerModel || null,
            finishedAt,
            durationMs,
            statusCode: params.statusCode ?? classification.statusCode ?? attempt.statusCode ?? null,
            failureKind: classification.kind,
            errorCode: classification.code,
            errorMessage: classification.message,
            metadata: params.metadata || attempt.metadata || null,
        };
    }));

    const latestAttempt = getLatestAttempt(attempts);
    const fallbackProvider = params.provider || typedError.provider || trip.aiMeta?.provider || FALLBACK_PROVIDER;
    const fallbackModel = params.model || typedError.model || trip.aiMeta?.model || FALLBACK_MODEL;
    const aiMeta = ensureAiMeta(trip, fallbackProvider, fallbackModel);

    return {
        ...trip,
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
    if (state === 'failed') return 'Failed';
    if (state === 'running') return 'Generating';
    if (state === 'queued') return 'Queued';
    return 'Generated';
};

export const getTripGenerationStateTone = (
    state: TripGenerationState,
): 'neutral' | 'warning' | 'danger' | 'success' => {
    if (state === 'failed') return 'danger';
    if (state === 'running' || state === 'queued') return 'warning';
    return 'success';
};
