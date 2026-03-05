import type { ITrip, TripGenerationFlow, TripGenerationInputSnapshot } from '../types';
import {
    buildClassicItineraryPrompt,
    buildSurpriseItineraryPrompt,
    buildWizardItineraryPrompt,
    generateTripFromInputSnapshot,
    type GenerateOptions,
    type SurpriseGenerateOptions,
    type TripGenerationRequestContext,
    type WizardGenerateOptions,
} from './aiService';
import { beginTripGenerationAbortTelemetry } from './tripGenerationAbortTelemetryService';
import {
    finishTripGenerationAttemptLog,
    startTripGenerationAttemptLog,
} from './tripGenerationAttemptLogService';
import {
    createTripGenerationInputSnapshot,
    createTripGenerationRequestId,
    markTripGenerationFailed,
    markTripGenerationRunning,
    markTripGenerationSucceeded,
    mergeGeneratedTripIntoExisting,
    withLatestTripGenerationAttemptId,
} from './tripGenerationDiagnosticsService';
import { dbCreateTripVersion, dbUpsertTrip, ensureDbSession } from './dbService';
import { supabase } from './supabaseClient';
import { generateTripId } from '../utils';
import { isFlowAsyncGenerationEnabled } from './tripGenerationAsyncConfig';
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asText = (value: unknown, fallback = ''): string => {
    if (typeof value !== 'string') return fallback;
    const next = value.trim();
    return next || fallback;
};

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

const applyTripDefaults = (trip: ITrip): ITrip => {
    const now = Date.now();
    return {
        ...trip,
        createdAt: typeof trip.createdAt === 'number' ? trip.createdAt : now,
        updatedAt: now,
        status: trip.status || 'active',
        tripExpiresAt: trip.tripExpiresAt ?? null,
        sourceKind: trip.sourceKind || 'created',
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

const runQueuedGeneration = async (
    snapshot: TripGenerationInputSnapshot,
    context: TripGenerationRequestContext,
): Promise<ITrip> => {
    return generateTripFromInputSnapshot(snapshot, {
        generationContext: context,
    });
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
        const provider = payload.options.aiTarget?.provider || 'gemini';
        const model = payload.options.aiTarget?.model || 'gemini-3-pro-preview';
        return {
            flow: 'classic',
            provider,
            model,
            roundTrip: Boolean(payload.options.roundTrip),
            prompt: buildClassicItineraryPrompt(payload.destinationPrompt, payload.options),
        };
    }
    if (payload.flow === 'wizard') {
        const provider = payload.options.aiTarget?.provider || 'gemini';
        const model = payload.options.aiTarget?.model || 'gemini-3-pro-preview';
        return {
            flow: 'wizard',
            provider,
            model,
            roundTrip: Boolean(payload.options.roundTrip),
            prompt: buildWizardItineraryPrompt(payload.options),
        };
    }

    const provider = payload.options.aiTarget?.provider || 'gemini';
    const model = payload.options.aiTarget?.model || 'gemini-3-pro-preview';
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
        throw new Error(error.message || 'Could not claim queued trip request.');
    }

    const row = (Array.isArray(data) ? data[0] : data) as TripGenerationRequestRow | null;
    if (!row?.request_id) {
        throw new Error('Queued request is missing, expired, or already processed.');
    }

    const flow = row.flow;
    if (flow !== 'classic' && flow !== 'wizard' && flow !== 'surprise') {
        throw new Error('Queued request flow is invalid.');
    }

    const parsedPayload = parseQueuedPayload(flow, row.payload);
    const generationSnapshot = buildInputSnapshotFromQueuedPayload(parsedPayload);

    if (isFlowAsyncGenerationEnabled(flow)) {
        return processQueuedTripGenerationAsync({
            requestId,
            payload: parsedPayload,
            snapshot: generationSnapshot,
        });
    }

    const tripId = generateTripId();
    const requestTraceId = createTripGenerationRequestId();

    const placeholderTrip = buildPlaceholderTrip(parsedPayload, tripId);
    const runningTrip = markTripGenerationRunning(placeholderTrip, {
        flow,
        source: 'queue_claim',
        inputSnapshot: generationSnapshot,
        provider: parsedPayload.options.aiTarget?.provider || 'gemini',
        model: parsedPayload.options.aiTarget?.model || 'gemini-3-pro-preview',
        requestId: requestTraceId,
        state: 'running',
    });
    let runningTripWithCanonicalAttempt = runningTrip;
    const runningAttempt = runningTripWithCanonicalAttempt.aiMeta?.generation?.latestAttempt || null;
    let attemptId = runningAttempt?.id || null;

    await ensureDbSession();
    await dbUpsertTrip(runningTripWithCanonicalAttempt, undefined);
    await dbCreateTripVersion(runningTripWithCanonicalAttempt, undefined, 'Data: Queued generation started');

    await updateQueuedRequestStatus(requestId, {
        status: 'running',
        result_trip_id: runningTrip.id,
        updated_at: new Date().toISOString(),
    });

    const loggedAttempt = await startTripGenerationAttemptLog({
        tripId: runningTripWithCanonicalAttempt.id,
        flow,
        source: 'queue_claim',
        state: 'running',
        provider: runningTripWithCanonicalAttempt.aiMeta?.provider,
        model: runningTripWithCanonicalAttempt.aiMeta?.model,
        requestId: requestTraceId,
        startedAt: runningAttempt?.startedAt,
        metadata: {
            request_id: requestId,
        },
    });

    if (loggedAttempt?.id) {
        runningTripWithCanonicalAttempt = withLatestTripGenerationAttemptId(runningTripWithCanonicalAttempt, loggedAttempt.id);
        attemptId = loggedAttempt.id;
        await ensureDbSession();
        await dbUpsertTrip(runningTripWithCanonicalAttempt, undefined);
    }

    const abortTelemetrySession = beginTripGenerationAbortTelemetry({
        tripId: runningTripWithCanonicalAttempt.id,
        attemptId: attemptId || 'unknown-attempt',
        requestId: requestTraceId,
        flow,
        source: 'queue_claim',
        provider: runningTripWithCanonicalAttempt.aiMeta?.provider,
        model: runningTripWithCanonicalAttempt.aiMeta?.model,
        startedAt: runningAttempt?.startedAt || null,
    });

    try {
        const generated = await runQueuedGeneration(generationSnapshot, {
            requestId: requestTraceId,
            tripId: runningTripWithCanonicalAttempt.id,
            attemptId,
            flow,
            source: 'queue_claim',
        });
        const mergedTrip = mergeGeneratedTripIntoExisting(runningTripWithCanonicalAttempt, applyTripDefaults(generated));
        const preparedTrip = markTripGenerationSucceeded(mergedTrip, {
            flow,
            source: 'queue_claim',
            provider: generated.aiMeta?.provider || runningTripWithCanonicalAttempt.aiMeta?.provider || 'gemini',
            model: generated.aiMeta?.model || runningTripWithCanonicalAttempt.aiMeta?.model || 'gemini-3-pro-preview',
            providerModel: generated.aiMeta?.generation?.latestAttempt?.providerModel || null,
            requestId: generated.aiMeta?.generation?.latestAttempt?.requestId || requestTraceId,
            durationMs: generated.aiMeta?.generation?.latestAttempt?.durationMs || null,
            statusCode: 200,
            attemptId,
            metadata: generated.aiMeta?.generation?.latestAttempt?.metadata || null,
        });

        await ensureDbSession();
        await dbUpsertTrip(preparedTrip, undefined);
        await dbCreateTripVersion(preparedTrip, undefined, 'Data: Queued generation completed');

        await updateQueuedRequestStatus(requestId, {
            status: 'completed',
            result_trip_id: preparedTrip.id,
            completed_at: new Date().toISOString(),
            error_message: null,
            updated_at: new Date().toISOString(),
        });

        if (loggedAttempt?.id) {
            await finishTripGenerationAttemptLog({
                attemptId: loggedAttempt.id,
                state: 'succeeded',
                provider: preparedTrip.aiMeta?.provider,
                model: preparedTrip.aiMeta?.model,
                requestId: preparedTrip.aiMeta?.generation?.latestAttempt?.requestId || requestTraceId,
                durationMs: preparedTrip.aiMeta?.generation?.latestAttempt?.durationMs || null,
                finishedAt: preparedTrip.aiMeta?.generation?.latestAttempt?.finishedAt || undefined,
            });
        }

        abortTelemetrySession.cancel();

        return {
            tripId: preparedTrip.id,
            trip: preparedTrip,
        };
    } catch (error) {
        const failedTrip = markTripGenerationFailed(runningTripWithCanonicalAttempt, {
            flow,
            source: 'queue_claim',
            error,
            provider: runningTripWithCanonicalAttempt.aiMeta?.provider,
            model: runningTripWithCanonicalAttempt.aiMeta?.model,
            requestId: requestTraceId,
            attemptId,
        });

        await ensureDbSession();
        await dbUpsertTrip(failedTrip, undefined);
        await dbCreateTripVersion(failedTrip, undefined, 'Data: Queued generation failed');

        await updateQueuedRequestStatus(requestId, {
            status: 'failed',
            result_trip_id: failedTrip.id,
            error_message: truncateError(error),
            updated_at: new Date().toISOString(),
        });

        if (loggedAttempt?.id) {
            await finishTripGenerationAttemptLog({
                attemptId: loggedAttempt.id,
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

        abortTelemetrySession.cancel();
        throw new QueuedTripGenerationError('Queued trip generation failed.', {
            tripId: failedTrip.id,
            cause: error,
        });
    }
};
