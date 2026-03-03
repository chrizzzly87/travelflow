import type { ITrip, TripGenerationFlow, TripGenerationInputSnapshot } from '../types';
import {
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
} from './tripGenerationDiagnosticsService';
import { dbCreateTripVersion, dbUpsertTrip, ensureDbSession } from './dbService';
import { supabase } from './supabaseClient';
import { generateTripId } from '../utils';

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
    const runningAttempt = runningTrip.aiMeta?.generation?.latestAttempt || null;

    await ensureDbSession();
    await dbUpsertTrip(runningTrip, undefined);
    await dbCreateTripVersion(runningTrip, undefined, 'Data: Queued generation started');

    await updateQueuedRequestStatus(requestId, {
        status: 'running',
        result_trip_id: runningTrip.id,
        updated_at: new Date().toISOString(),
    });

    const loggedAttempt = await startTripGenerationAttemptLog({
        tripId: runningTrip.id,
        flow,
        source: 'queue_claim',
        state: 'running',
        provider: runningTrip.aiMeta?.provider,
        model: runningTrip.aiMeta?.model,
        requestId: requestTraceId,
        startedAt: runningAttempt?.startedAt,
        metadata: {
            request_id: requestId,
        },
    });

    const abortTelemetrySession = beginTripGenerationAbortTelemetry({
        tripId: runningTrip.id,
        attemptId: runningAttempt?.id || 'unknown-attempt',
        requestId: requestTraceId,
        flow,
        source: 'queue_claim',
        provider: runningTrip.aiMeta?.provider,
        model: runningTrip.aiMeta?.model,
        startedAt: runningAttempt?.startedAt || null,
    });

    try {
        const generated = await runQueuedGeneration(generationSnapshot, {
            requestId: requestTraceId,
            tripId: runningTrip.id,
            attemptId: runningAttempt?.id,
            flow,
            source: 'queue_claim',
        });
        const mergedTrip = mergeGeneratedTripIntoExisting(runningTrip, applyTripDefaults(generated));
        const preparedTrip = markTripGenerationSucceeded(mergedTrip, {
            flow,
            source: 'queue_claim',
            provider: generated.aiMeta?.provider || runningTrip.aiMeta?.provider || 'gemini',
            model: generated.aiMeta?.model || runningTrip.aiMeta?.model || 'gemini-3-pro-preview',
            providerModel: generated.aiMeta?.generation?.latestAttempt?.providerModel || null,
            requestId: generated.aiMeta?.generation?.latestAttempt?.requestId || requestTraceId,
            durationMs: generated.aiMeta?.generation?.latestAttempt?.durationMs || null,
            statusCode: 200,
            attemptId: runningAttempt?.id,
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
        const failedTrip = markTripGenerationFailed(runningTrip, {
            flow,
            source: 'queue_claim',
            error,
            provider: runningTrip.aiMeta?.provider,
            model: runningTrip.aiMeta?.model,
            requestId: requestTraceId,
            attemptId: runningAttempt?.id,
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
