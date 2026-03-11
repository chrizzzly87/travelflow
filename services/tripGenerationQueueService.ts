import type { ITrip, TripGenerationFlow, TripGenerationInputSnapshot } from '../types';
import { getDefaultCreateTripModel } from '../config/aiModelCatalog';
import {
    buildClassicItineraryPrompt,
    buildSurpriseItineraryPrompt,
    buildWizardItineraryPrompt,
    type GenerateOptions,
    type SurpriseGenerateOptions,
    type WizardGenerateOptions,
} from './aiService';
import {
    finishTripGenerationAttemptLog,
    startTripGenerationAttemptLog,
} from './tripGenerationAttemptLogService';
import {
    createTripGenerationInputSnapshot,
    createTripGenerationRequestId,
    markTripGenerationFailed,
    markTripGenerationRunning,
    withLatestTripGenerationAttemptId,
} from './tripGenerationDiagnosticsService';
import { dbCreateTripVersion, dbUpsertTrip, ensureDbSession } from './dbService';
import { supabase } from './supabaseClient';
import { generateTripId } from '../utils';
import { enqueueAsyncTripGenerationJob } from './tripGenerationAsyncEnqueueService';

interface BaseQueuedPayload {
    version: 1;
    destinationLabel: string;
    startDate: string;
    endDate: string;
}

interface QueuedClassicPayload extends BaseQueuedPayload {
    flow: 'classic';
    destinationPrompt: string;
    options: GenerateOptions;
}

interface QueuedWizardPayload extends BaseQueuedPayload {
    flow: 'wizard';
    options: WizardGenerateOptions;
}

interface QueuedSurprisePayload extends BaseQueuedPayload {
    flow: 'surprise';
    options: SurpriseGenerateOptions;
}

export type QueuedTripGenerationPayload =
    | QueuedClassicPayload
    | QueuedWizardPayload
    | QueuedSurprisePayload;

interface TripGenerationRequestRow {
    request_id: string;
    flow: TripGenerationFlow;
    payload: unknown;
    status: string;
    owner_user_id: string | null;
    expires_at: string;
    result_trip_id?: string | null;
}

export class QueuedTripGenerationError extends Error {
    tripId: string | null;
    causeError: unknown;

    constructor(message: string, details?: { tripId?: string | null; cause?: unknown }) {
        super(message);
        this.name = 'QueuedTripGenerationError';
        this.tripId = details?.tripId || null;
        this.causeError = details?.cause;
    }
}

export class QueuedTripGenerationAlreadyClaimedError extends QueuedTripGenerationError {
    requestId: string | null;
    claimedByAnotherUser: boolean;

    constructor(message: string, details?: { tripId?: string | null; requestId?: string | null; cause?: unknown; claimedByAnotherUser?: boolean }) {
        super(message, { tripId: details?.tripId, cause: details?.cause });
        this.name = 'QueuedTripGenerationAlreadyClaimedError';
        this.requestId = details?.requestId || null;
        this.claimedByAnotherUser = details?.claimedByAnotherUser === true;
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asText = (value: unknown, fallback = ''): string => {
    if (typeof value !== 'string') return fallback;
    const next = value.trim();
    return next || fallback;
};

const sleep = (durationMs: number): Promise<void> => (
    new Promise((resolve) => {
        setTimeout(resolve, durationMs);
    })
);

const isAlreadyClaimedQueueError = (error: { code?: string | null; message?: string | null } | null | undefined): boolean => {
    const code = typeof error?.code === 'string' ? error.code.trim().toUpperCase() : '';
    const message = typeof error?.message === 'string' ? error.message.trim().toLowerCase() : '';
    return code === 'P0001' || message.includes('already claimed') || message.includes('already processed');
};

const isClaimedByAnotherUserQueueError = (error: { message?: string | null } | null | undefined): boolean => {
    const message = typeof error?.message === 'string' ? error.message.trim().toLowerCase() : '';
    return message.includes('already claimed by another user');
};

export const isQueuedTripGenerationAlreadyClaimedError = (error: unknown): error is QueuedTripGenerationAlreadyClaimedError => (
    error instanceof QueuedTripGenerationAlreadyClaimedError
);

export const isQueuedTripGenerationClaimedByAnotherUserError = (error: unknown): error is QueuedTripGenerationAlreadyClaimedError => (
    error instanceof QueuedTripGenerationAlreadyClaimedError
    && error.claimedByAnotherUser === true
);

const DEFAULT_CREATE_MODEL = getDefaultCreateTripModel();

const parseQueuedPayload = (flow: TripGenerationFlow, payload: unknown): QueuedTripGenerationPayload => {
    if (!isRecord(payload)) {
        throw new Error('Queued request payload is invalid.');
    }

    const version = Number(payload.version);
    if (!Number.isFinite(version) || version < 1) {
        throw new Error('Queued request payload version is invalid.');
    }

    const destinationLabel = asText(payload.destinationLabel, 'Trip');
    const startDate = asText(payload.startDate);
    const endDate = asText(payload.endDate);

    if (!startDate || !endDate) {
        throw new Error('Queued request date payload is missing.');
    }

    if (flow === 'classic') {
        const destinationPrompt = asText(payload.destinationPrompt);
        if (!destinationPrompt) {
            throw new Error('Queued classic request is missing destination prompt.');
        }
        return {
            version: 1,
            flow,
            destinationLabel,
            startDate,
            endDate,
            destinationPrompt,
            options: isRecord(payload.options) ? payload.options as GenerateOptions : {},
        };
    }

    if (flow === 'wizard') {
        return {
            version: 1,
            flow,
            destinationLabel,
            startDate,
            endDate,
            options: isRecord(payload.options) ? payload.options as WizardGenerateOptions : { countries: [] },
        };
    }

    return {
        version: 1,
        flow: 'surprise',
        destinationLabel,
        startDate,
        endDate,
        options: isRecord(payload.options) ? payload.options as SurpriseGenerateOptions : { country: destinationLabel },
    };
};

const truncateError = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message.slice(0, 400);
    }
    return 'Unknown queue processing error';
};

const updateQueuedRequestStatus = async (
    requestId: string,
    patch: Record<string, unknown>
): Promise<void> => {
    if (!supabase) return;
    await supabase
        .from('trip_generation_requests')
        .update(patch)
        .eq('id', requestId);
};

const buildInputSnapshotFromQueuedPayload = (
    payload: QueuedTripGenerationPayload,
): TripGenerationInputSnapshot => {
    if (payload.flow === 'classic') {
        return createTripGenerationInputSnapshot({
            flow: 'classic',
            destinationLabel: payload.destinationLabel,
            startDate: payload.startDate,
            endDate: payload.endDate,
            payload: {
                destinationPrompt: payload.destinationPrompt,
                options: payload.options,
            },
        });
    }

    return createTripGenerationInputSnapshot({
        flow: payload.flow,
        destinationLabel: payload.destinationLabel,
        startDate: payload.startDate,
        endDate: payload.endDate,
        payload: {
            options: payload.options,
        },
    });
};

const buildPlaceholderTrip = (
    payload: QueuedTripGenerationPayload,
    tripId: string,
): ITrip => {
    const now = Date.now();
    const destinationLabel = payload.destinationLabel || 'Trip';
    return {
        id: tripId,
        title: destinationLabel,
        startDate: payload.startDate,
        items: [
            {
                id: `queue-loading-city-${tripId}`,
                type: 'city',
                title: destinationLabel,
                startDateOffset: 0,
                duration: 1,
                color: 'bg-slate-100 border-slate-200 text-slate-500',
                description: 'Queued generation is preparing this trip.',
                location: destinationLabel,
                loading: true,
            },
        ],
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
        sourceKind: 'created',
        status: 'active',
        tripExpiresAt: null,
    };
};

const readQueuedRequestRow = async (requestId: string): Promise<TripGenerationRequestRow | null> => {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('trip_generation_requests')
        .select('id, flow, payload, status, owner_user_id, expires_at, result_trip_id')
        .eq('id', requestId)
        .maybeSingle();

    if (error || !data) return null;

    const row = data as Record<string, unknown>;
    const flow = row.flow;
    if (flow !== 'classic' && flow !== 'wizard' && flow !== 'surprise') return null;

    const resolvedRequestId = asText(row.id) || requestId;
    const expiresAt = asText(row.expires_at);
    if (!resolvedRequestId || !expiresAt) return null;

    return {
        request_id: resolvedRequestId,
        flow,
        payload: row.payload,
        status: asText(row.status),
        owner_user_id: asText(row.owner_user_id) || null,
        expires_at: expiresAt,
        result_trip_id: asText(row.result_trip_id) || null,
    };
};

const buildRecoveredQueuedTripResult = (
    row: TripGenerationRequestRow,
): { tripId: string; trip: ITrip } | null => {
    const tripId = asText(row.result_trip_id);
    if (!tripId) return null;

    try {
        const parsedPayload = parseQueuedPayload(row.flow, row.payload);
        return {
            tripId,
            trip: buildPlaceholderTrip(parsedPayload, tripId),
        };
    } catch {
        const now = Date.now();
        return {
            tripId,
            trip: {
                id: tripId,
                title: 'Trip',
                startDate: new Date(now).toISOString().slice(0, 10),
                items: [],
                createdAt: now,
                updatedAt: now,
                isFavorite: false,
                sourceKind: 'created',
                status: 'active',
                tripExpiresAt: null,
            },
        };
    }
};

const recoverExistingQueuedClaimResult = async (
    requestId: string,
    initialRow?: TripGenerationRequestRow | null,
): Promise<{ tripId: string; trip: ITrip } | null> => {
    const firstPass = initialRow ? buildRecoveredQueuedTripResult(initialRow) : null;
    if (firstPass) return firstPass;

    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const row = await readQueuedRequestRow(requestId);
        const recovered = row ? buildRecoveredQueuedTripResult(row) : null;
        if (recovered) return recovered;
        if (attempt < maxAttempts - 1) {
            await sleep(250);
        }
    }

    return null;
};

interface AsyncClaimParams {
    requestId: string;
    payload: QueuedTripGenerationPayload;
    snapshot: TripGenerationInputSnapshot;
}

const resolveAsyncQueuedExecutionParams = (payload: QueuedTripGenerationPayload): {
    flow: TripGenerationFlow;
    provider: string;
    model: string;
    roundTrip: boolean;
    prompt: string;
} => {
    if (payload.flow === 'classic') {
        const provider = payload.options.aiTarget?.provider || DEFAULT_CREATE_MODEL.provider;
        const model = payload.options.aiTarget?.model || DEFAULT_CREATE_MODEL.model;
        return {
            flow: 'classic',
            provider,
            model,
            roundTrip: Boolean(payload.options.roundTrip),
            prompt: buildClassicItineraryPrompt(payload.destinationPrompt, payload.options),
        };
    }
    if (payload.flow === 'wizard') {
        const provider = payload.options.aiTarget?.provider || DEFAULT_CREATE_MODEL.provider;
        const model = payload.options.aiTarget?.model || DEFAULT_CREATE_MODEL.model;
        return {
            flow: 'wizard',
            provider,
            model,
            roundTrip: Boolean(payload.options.roundTrip),
            prompt: buildWizardItineraryPrompt(payload.options),
        };
    }

    const provider = payload.options.aiTarget?.provider || DEFAULT_CREATE_MODEL.provider;
    const model = payload.options.aiTarget?.model || DEFAULT_CREATE_MODEL.model;
    return {
        flow: 'surprise',
        provider,
        model,
        roundTrip: true,
        prompt: buildSurpriseItineraryPrompt(payload.options),
    };
};

const processQueuedTripGenerationAsync = async (
    params: AsyncClaimParams,
): Promise<{ tripId: string; trip: ITrip }> => {
    const requestTraceId = createTripGenerationRequestId();
    const tripId = generateTripId();
    const source = 'queue_claim_async';
    const execution = resolveAsyncQueuedExecutionParams(params.payload);

    const placeholderTrip = buildPlaceholderTrip(params.payload, tripId);
    let queuedTrip = markTripGenerationRunning(placeholderTrip, {
        flow: execution.flow,
        source,
        inputSnapshot: params.snapshot,
        provider: execution.provider,
        model: execution.model,
        requestId: requestTraceId,
        state: 'queued',
    });
    let attemptId = queuedTrip.aiMeta?.generation?.latestAttempt?.id || null;
    let loggedAttemptId: string | null = null;

    await ensureDbSession();
    await dbUpsertTrip(queuedTrip, undefined);
    await dbCreateTripVersion(queuedTrip, undefined, 'Data: Queued generation started');

    const loggedAttempt = await startTripGenerationAttemptLog({
        tripId,
        flow: execution.flow,
        source,
        state: 'queued',
        provider: execution.provider,
        model: execution.model,
        requestId: requestTraceId,
        startedAt: queuedTrip.aiMeta?.generation?.latestAttempt?.startedAt,
        metadata: {
            request_id: params.requestId,
            orchestration: 'async_worker',
        },
    });

    if (loggedAttempt?.id) {
        loggedAttemptId = loggedAttempt.id;
        queuedTrip = withLatestTripGenerationAttemptId(queuedTrip, loggedAttempt.id);
        attemptId = loggedAttempt.id;
        await ensureDbSession();
        await dbUpsertTrip(queuedTrip, undefined);
    }

    try {
        if (!attemptId) {
            throw new Error('Queued generation attempt id is missing.');
        }

        const enqueueSucceeded = await enqueueAsyncTripGenerationJob({
            flow: execution.flow,
            tripId,
            attemptId,
            startedAt: loggedAttempt?.startedAt || queuedTrip.aiMeta?.generation?.latestAttempt?.startedAt || null,
            requestId: requestTraceId,
            source,
            queueRequestId: params.requestId,
            startDate: params.payload.startDate,
            roundTrip: execution.roundTrip,
            prompt: execution.prompt,
            provider: execution.provider,
            model: execution.model,
            inputSnapshot: params.snapshot,
            maxRetries: 0,
        });

        if (!enqueueSucceeded) {
            throw new Error('Could not enqueue async generation job.');
        }

        await updateQueuedRequestStatus(params.requestId, {
            status: 'queued',
            result_trip_id: tripId,
            error_message: null,
            updated_at: new Date().toISOString(),
        });

        return {
            tripId,
            trip: queuedTrip,
        };
    } catch (error) {
        const failedTrip = markTripGenerationFailed(queuedTrip, {
            flow: execution.flow,
            source,
            error,
            provider: execution.provider,
            model: execution.model,
            requestId: requestTraceId,
            attemptId,
            metadata: {
                requestId: params.requestId,
                orchestration: 'async_worker_enqueue',
            },
        });

        await ensureDbSession();
        await dbUpsertTrip(failedTrip, undefined);
        await dbCreateTripVersion(failedTrip, undefined, 'Data: Queued generation failed');

        await updateQueuedRequestStatus(params.requestId, {
            status: 'failed',
            result_trip_id: tripId,
            error_message: truncateError(error),
            updated_at: new Date().toISOString(),
        });

        if (loggedAttemptId) {
            await finishTripGenerationAttemptLog({
                attemptId: loggedAttemptId,
                state: 'failed',
                provider: failedTrip.aiMeta?.provider,
                model: failedTrip.aiMeta?.model,
                requestId: failedTrip.aiMeta?.generation?.latestAttempt?.requestId || requestTraceId,
                durationMs: failedTrip.aiMeta?.generation?.latestAttempt?.durationMs || null,
                statusCode: failedTrip.aiMeta?.generation?.latestAttempt?.statusCode || null,
                failureKind: failedTrip.aiMeta?.generation?.latestAttempt?.failureKind || null,
                errorCode: failedTrip.aiMeta?.generation?.latestAttempt?.errorCode || null,
                errorMessage: failedTrip.aiMeta?.generation?.latestAttempt?.errorMessage || truncateError(error),
                finishedAt: failedTrip.aiMeta?.generation?.latestAttempt?.finishedAt || undefined,
            });
        }

        throw new QueuedTripGenerationError('Queued trip generation failed.', {
            tripId,
            cause: error,
        });
    }
};

export const runOpportunisticTripQueueCleanup = async (): Promise<void> => {
    if (!supabase) return;
    try {
        await supabase.rpc('expire_stale_trip_generation_requests');
    } catch {
        // non-blocking maintenance
    }
};

export const createTripGenerationRequest = async (
    flow: TripGenerationFlow,
    payload: QueuedTripGenerationPayload,
    expiresInDays = 14
): Promise<{ requestId: string; expiresAt: string }> => {
    if (!supabase) {
        throw new Error('Supabase is not configured.');
    }

    await ensureDbSession();
    const { data, error } = await supabase.rpc('create_trip_generation_request', {
        p_flow: flow,
        p_payload: payload,
        p_expires_in_days: expiresInDays,
    });
    if (error) {
        throw new Error(error.message || 'Could not queue trip request.');
    }

    const row = (Array.isArray(data) ? data[0] : data) as { request_id?: string; expires_at?: string } | null;
    const requestId = row?.request_id || '';
    const expiresAt = row?.expires_at || '';
    if (!requestId || !expiresAt) {
        throw new Error('Queue request was created but response payload is invalid.');
    }

    return { requestId, expiresAt };
};

export const processQueuedTripGenerationAfterAuth = async (
    requestId: string
): Promise<{ tripId: string; trip: ITrip }> => {
    if (!supabase) {
        throw new Error('Supabase is not configured.');
    }

    await ensureDbSession();
    const { data, error } = await supabase.rpc('claim_trip_generation_request', {
        p_request_id: requestId,
    });
    if (error) {
        if (isClaimedByAnotherUserQueueError(error)) {
            throw new QueuedTripGenerationAlreadyClaimedError(
                'Queued request was already claimed by another user.',
                {
                    requestId,
                    cause: error,
                    claimedByAnotherUser: true,
                },
            );
        }
        if (isAlreadyClaimedQueueError(error)) {
            const recovered = await recoverExistingQueuedClaimResult(requestId);
            if (recovered) {
                return recovered;
            }
            throw new QueuedTripGenerationAlreadyClaimedError(
                'Queued request is already being processed.',
                {
                    requestId,
                    cause: error,
                },
            );
        }
        throw new Error(error.message || 'Could not claim queued trip request.');
    }

    const row = (Array.isArray(data) ? data[0] : data) as TripGenerationRequestRow | null;
    if (!row?.request_id) {
        const recovered = await recoverExistingQueuedClaimResult(requestId);
        if (recovered) {
            return recovered;
        }
        throw new Error('Queued request is missing, expired, or already processed.');
    }
    if (row.status !== 'queued') {
        const recovered = await recoverExistingQueuedClaimResult(requestId, row);
        if (recovered) {
            return recovered;
        }
        throw new QueuedTripGenerationAlreadyClaimedError(
            'Queued request is already claimed or processed.',
            {
                requestId,
                tripId: asText(row.result_trip_id) || null,
            },
        );
    }

    const flow = row.flow;
    if (flow !== 'classic' && flow !== 'wizard' && flow !== 'surprise') {
        throw new Error('Queued request flow is invalid.');
    }

    const parsedPayload = parseQueuedPayload(flow, row.payload);
    const generationSnapshot = buildInputSnapshotFromQueuedPayload(parsedPayload);

    return processQueuedTripGenerationAsync({
        requestId,
        payload: parsedPayload,
        snapshot: generationSnapshot,
    });
};
