import { getAiModelById, getDefaultCreateTripModel } from '../config/aiModelCatalog';
import type {
    TripGenerationRequestContext,
} from './aiService';
import {
    generateTripFromInputSnapshot,
} from './aiService';
import {
    beginTripGenerationAbortTelemetry,
} from './tripGenerationAbortTelemetryService';
import {
    finishTripGenerationAttemptLog,
    startTripGenerationAttemptLog,
} from './tripGenerationAttemptLogService';
import {
    createTripGenerationRequestId,
    markTripGenerationFailed,
    markTripGenerationRunning,
    markTripGenerationSucceeded,
    mergeGeneratedTripIntoExisting,
    withLatestTripGenerationAttemptId,
} from './tripGenerationDiagnosticsService';
import type { ITrip, TripGenerationFlow, TripGenerationInputSnapshot } from '../types';

export interface RetryTripGenerationOptions {
    source: string;
    onTripUpdate?: (trip: ITrip) => Promise<void> | void;
    contextSource?: string;
    modelId?: string | null;
}

export interface RetryTripGenerationResult {
    trip: ITrip;
    state: 'succeeded' | 'failed';
    error?: unknown;
}

const generateFromSnapshot = async (
    snapshot: TripGenerationInputSnapshot,
    context: TripGenerationRequestContext,
    aiTarget: {
        provider: ReturnType<typeof getDefaultCreateTripModel>['provider'];
        model: string;
    },
) => {
    return generateTripFromInputSnapshot(snapshot, {
        aiTarget,
        generationContext: context,
    });
};

const resolveRetryModelTarget = (modelId?: string | null) => {
    if (modelId) {
        const selectedModel = getAiModelById(modelId);
        if (selectedModel && selectedModel.availability === 'active') {
            return selectedModel;
        }
    }
    return getDefaultCreateTripModel();
};

export const retryTripGenerationWithDefaultModel = async (
    trip: ITrip,
    options: RetryTripGenerationOptions,
): Promise<RetryTripGenerationResult> => {
    const snapshot = trip.aiMeta?.generation?.inputSnapshot;
    if (!snapshot) {
        throw new Error('Retry is unavailable because this trip has no generation input snapshot.');
    }

    const requestId = createTripGenerationRequestId();
    const retryModel = resolveRetryModelTarget(options.modelId);

    const runningTrip = markTripGenerationRunning(trip, {
        flow: snapshot.flow,
        source: options.source,
        inputSnapshot: snapshot,
        provider: retryModel.provider,
        model: retryModel.model,
        requestId,
        state: 'running',
        isRetry: true,
        metadata: {
            requestedModelId: options.modelId || null,
            resolvedModelId: retryModel.id,
        },
    });

    let runningTripWithCanonicalAttempt = runningTrip;
    const runningAttempt = runningTripWithCanonicalAttempt.aiMeta?.generation?.latestAttempt || null;
    let attemptId = runningAttempt?.id || null;

    if (options.onTripUpdate) {
        await options.onTripUpdate(runningTripWithCanonicalAttempt);
    }

    const loggedAttempt = await startTripGenerationAttemptLog({
        tripId: trip.id,
        flow: snapshot.flow,
        source: options.source,
        state: 'running',
        provider: retryModel.provider,
        model: retryModel.model,
        requestId,
        startedAt: runningAttempt?.startedAt,
        metadata: {
            requested_model_id: options.modelId || null,
            resolved_model_id: retryModel.id,
        },
    });

    if (loggedAttempt?.id) {
        runningTripWithCanonicalAttempt = withLatestTripGenerationAttemptId(runningTripWithCanonicalAttempt, loggedAttempt.id);
        attemptId = loggedAttempt.id;
        if (options.onTripUpdate) {
            await options.onTripUpdate(runningTripWithCanonicalAttempt);
        }
    }

    const telemetrySession = beginTripGenerationAbortTelemetry({
        tripId: trip.id,
        attemptId: attemptId || 'unknown-attempt',
        requestId,
        flow: snapshot.flow,
        source: options.source,
        provider: retryModel.provider,
        model: retryModel.model,
    });

    try {
        const generatedTrip = await generateFromSnapshot(snapshot, {
            requestId,
            tripId: trip.id,
            attemptId: attemptId || undefined,
            flow: snapshot.flow,
            source: options.contextSource || options.source,
        }, {
            provider: retryModel.provider,
            model: retryModel.model,
        });

        const merged = mergeGeneratedTripIntoExisting(runningTripWithCanonicalAttempt, generatedTrip);
        const succeeded = markTripGenerationSucceeded(merged, {
            flow: snapshot.flow,
            source: options.source,
            provider: generatedTrip.aiMeta?.provider || retryModel.provider,
            model: generatedTrip.aiMeta?.model || retryModel.model,
            providerModel: generatedTrip.aiMeta?.generation?.latestAttempt?.providerModel || null,
            requestId,
            attemptId,
            durationMs: generatedTrip.aiMeta?.generation?.latestAttempt?.durationMs || null,
            metadata: generatedTrip.aiMeta?.generation?.latestAttempt?.metadata || null,
        });

        if (options.onTripUpdate) {
            await options.onTripUpdate(succeeded);
        }

        if (loggedAttempt?.id) {
            await finishTripGenerationAttemptLog({
                attemptId: loggedAttempt.id,
                state: 'succeeded',
                provider: succeeded.aiMeta?.provider,
                model: succeeded.aiMeta?.model,
                requestId,
                durationMs: succeeded.aiMeta?.generation?.latestAttempt?.durationMs || null,
                finishedAt: succeeded.aiMeta?.generation?.latestAttempt?.finishedAt || undefined,
            });
        }

        return {
            state: 'succeeded',
            trip: succeeded,
        };
    } catch (error) {
        const failed = markTripGenerationFailed(runningTripWithCanonicalAttempt, {
            flow: snapshot.flow,
            source: options.source,
            error,
            provider: retryModel.provider,
            model: retryModel.model,
            requestId,
            attemptId,
            metadata: {
                requestedModelId: options.modelId || null,
                resolvedModelId: retryModel.id,
            },
        });

        if (options.onTripUpdate) {
            await options.onTripUpdate(failed);
        }

        if (loggedAttempt?.id) {
            await finishTripGenerationAttemptLog({
                attemptId: loggedAttempt.id,
                state: 'failed',
                provider: failed.aiMeta?.provider,
                model: failed.aiMeta?.model,
                requestId,
                durationMs: failed.aiMeta?.generation?.latestAttempt?.durationMs || null,
                statusCode: failed.aiMeta?.generation?.latestAttempt?.statusCode || null,
                failureKind: failed.aiMeta?.generation?.latestAttempt?.failureKind || null,
                errorCode: failed.aiMeta?.generation?.latestAttempt?.errorCode || null,
                errorMessage: failed.aiMeta?.generation?.latestAttempt?.errorMessage || null,
                finishedAt: failed.aiMeta?.generation?.latestAttempt?.finishedAt || undefined,
            });
        }

        return {
            state: 'failed',
            trip: failed,
            error,
        };
    } finally {
        telemetrySession.cancel();
    }
};

export const getRetryFlowFromTrip = (trip: ITrip): TripGenerationFlow | null => {
    const flow = trip.aiMeta?.generation?.inputSnapshot?.flow;
    return flow === 'classic' || flow === 'wizard' || flow === 'surprise' ? flow : null;
};
