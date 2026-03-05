import type { ITrip, TripGenerationFlow, TripGenerationInputSnapshot } from '../types';
import { generateTripId } from '../utils';
import { enqueueAsyncTripGenerationJob } from './tripGenerationAsyncEnqueueService';
import {
    finishTripGenerationAttemptLog,
    startTripGenerationAttemptLog,
} from './tripGenerationAttemptLogService';
import {
    createTripGenerationRequestId,
    markTripGenerationFailed,
    markTripGenerationRunning,
    withLatestTripGenerationAttemptId,
} from './tripGenerationDiagnosticsService';

interface StartClientAsyncTripGenerationParams {
    flow: TripGenerationFlow;
    source: string;
    jobSource?: string;
    destinationLabel: string;
    startDate: string;
    roundTrip: boolean;
    prompt: string;
    provider: string;
    model: string;
    inputSnapshot: TripGenerationInputSnapshot;
    buildOptimisticTrip: (tripId: string) => ITrip;
    onTripUpdate: (trip: ITrip) => void | Promise<void>;
    maxRetries?: number;
    queueRequestId?: string | null;
    metadata?: Record<string, unknown> | null;
}

export interface StartClientAsyncTripGenerationResult {
    trip: ITrip;
    tripId: string;
    attemptId: string | null;
    requestId: string;
}

const mergeMetadata = (
    ...values: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> | null => {
    const merged: Record<string, unknown> = {};
    values.forEach((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return;
        Object.assign(merged, value);
    });
    return Object.keys(merged).length > 0 ? merged : null;
};

export const startClientAsyncTripGeneration = async (
    params: StartClientAsyncTripGenerationParams,
): Promise<StartClientAsyncTripGenerationResult> => {
    const tripId = generateTripId();
    const requestId = createTripGenerationRequestId();

    let queuedTrip = markTripGenerationRunning(params.buildOptimisticTrip(tripId), {
        flow: params.flow,
        source: params.source,
        inputSnapshot: params.inputSnapshot,
        provider: params.provider,
        model: params.model,
        requestId,
        state: 'queued',
        metadata: mergeMetadata(params.metadata, {
            orchestration: 'async_worker',
            destination_label: params.destinationLabel,
        }),
    });

    await params.onTripUpdate(queuedTrip);

    const queuedAttempt = queuedTrip.aiMeta?.generation?.latestAttempt || null;
    let attemptId = queuedAttempt?.id || null;

    const loggedAttempt = await startTripGenerationAttemptLog({
        tripId,
        flow: params.flow,
        source: params.source,
        state: 'queued',
        provider: params.provider,
        model: params.model,
        requestId,
        startedAt: queuedAttempt?.startedAt,
        metadata: mergeMetadata(params.metadata, {
            orchestration: 'async_worker',
            destination_label: params.destinationLabel,
        }),
    });

    if (loggedAttempt?.id) {
        queuedTrip = withLatestTripGenerationAttemptId(queuedTrip, loggedAttempt.id);
        attemptId = loggedAttempt.id;
        await params.onTripUpdate(queuedTrip);
    }

    try {
        if (!attemptId) {
            throw new Error('Generation attempt id is missing.');
        }

        const enqueueSucceeded = await enqueueAsyncTripGenerationJob({
            flow: params.flow,
            tripId,
            attemptId,
            requestId,
            source: params.jobSource || params.source,
            queueRequestId: params.queueRequestId || null,
            startDate: params.startDate,
            roundTrip: params.roundTrip,
            prompt: params.prompt,
            provider: params.provider,
            model: params.model,
            inputSnapshot: params.inputSnapshot,
            maxRetries: params.maxRetries ?? 0,
        });

        if (!enqueueSucceeded) {
            throw new Error('Could not enqueue async generation.');
        }

        return {
            trip: queuedTrip,
            tripId,
            attemptId,
            requestId,
        };
    } catch (error) {
        const failedTrip = markTripGenerationFailed(queuedTrip, {
            flow: params.flow,
            source: params.source,
            error,
            provider: params.provider,
            model: params.model,
            requestId,
            attemptId,
            metadata: mergeMetadata(params.metadata, {
                orchestration: 'async_worker_enqueue',
                destination_label: params.destinationLabel,
            }),
        });
        await params.onTripUpdate(failedTrip);

        if (loggedAttempt?.id) {
            await finishTripGenerationAttemptLog({
                attemptId: loggedAttempt.id,
                state: 'failed',
                provider: failedTrip.aiMeta?.provider,
                model: failedTrip.aiMeta?.model,
                requestId: failedTrip.aiMeta?.generation?.latestAttempt?.requestId || requestId,
                durationMs: failedTrip.aiMeta?.generation?.latestAttempt?.durationMs || null,
                statusCode: failedTrip.aiMeta?.generation?.latestAttempt?.statusCode || null,
                failureKind: failedTrip.aiMeta?.generation?.latestAttempt?.failureKind || null,
                errorCode: failedTrip.aiMeta?.generation?.latestAttempt?.errorCode || null,
                errorMessage: failedTrip.aiMeta?.generation?.latestAttempt?.errorMessage || null,
                finishedAt: failedTrip.aiMeta?.generation?.latestAttempt?.finishedAt || undefined,
            });
        }

        throw error;
    }
};
