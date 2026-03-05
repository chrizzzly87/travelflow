import { getAiModelById, getDefaultCreateTripModel } from '../config/aiModelCatalog';
import type {
    GenerateOptions,
    SurpriseGenerateOptions,
    WizardGenerateOptions,
} from './aiService';
import {
    buildClassicItineraryPrompt,
    buildSurpriseItineraryPrompt,
    buildWizardItineraryPrompt,
} from './aiService';
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
import type { ITrip, TripGenerationFlow, TripGenerationInputSnapshot } from '../types';
import { enqueueAsyncTripGenerationJob } from './tripGenerationAsyncEnqueueService';

export interface RetryTripGenerationOptions {
    source: string;
    onTripUpdate?: (trip: ITrip) => Promise<void> | void;
    contextSource?: string;
    modelId?: string | null;
}

export interface RetryTripGenerationResult {
    trip: ITrip;
    state: 'queued' | 'failed';
    error?: unknown;
}

const resolveRetryModelTarget = (modelId?: string | null) => {
    if (modelId) {
        const selectedModel = getAiModelById(modelId);
        if (selectedModel && selectedModel.availability === 'active') {
            return selectedModel;
        }
    }
    return getDefaultCreateTripModel();
};

const buildRetryPromptFromSnapshot = (
    snapshot: TripGenerationInputSnapshot,
): string => {
    if (snapshot.flow === 'classic') {
        const destinationPrompt = typeof snapshot.payload.destinationPrompt === 'string'
            ? snapshot.payload.destinationPrompt.trim()
            : '';
        if (!destinationPrompt) {
            throw new Error('Retry snapshot is missing destination prompt.');
        }
        const classicOptions = (snapshot.payload.options && typeof snapshot.payload.options === 'object')
            ? snapshot.payload.options as GenerateOptions
            : {} as GenerateOptions;
        return buildClassicItineraryPrompt(destinationPrompt, classicOptions);
    }

    if (snapshot.flow === 'wizard') {
        const wizardOptions = (snapshot.payload.options && typeof snapshot.payload.options === 'object')
            ? snapshot.payload.options as WizardGenerateOptions
            : { countries: [] } as WizardGenerateOptions;
        return buildWizardItineraryPrompt(wizardOptions);
    }

    const surpriseOptions = (snapshot.payload.options && typeof snapshot.payload.options === 'object')
        ? snapshot.payload.options as SurpriseGenerateOptions
        : { country: '' } as SurpriseGenerateOptions;
    return buildSurpriseItineraryPrompt(surpriseOptions);
};

const resolveRetryRoundTrip = (
    snapshot: TripGenerationInputSnapshot,
    trip: ITrip,
): boolean => {
    if (snapshot.flow === 'classic') {
        const options = (snapshot.payload.options && typeof snapshot.payload.options === 'object')
            ? snapshot.payload.options as GenerateOptions
            : {} as GenerateOptions;
        return Boolean(options.roundTrip || trip.roundTrip);
    }
    if (snapshot.flow === 'wizard') {
        const options = (snapshot.payload.options && typeof snapshot.payload.options === 'object')
            ? snapshot.payload.options as WizardGenerateOptions
            : { countries: [] } as WizardGenerateOptions;
        return Boolean(options.roundTrip || trip.roundTrip);
    }
    return true;
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
        state: 'queued',
        isRetry: true,
        metadata: {
            requestedModelId: options.modelId || null,
            resolvedModelId: retryModel.id,
            orchestration: 'async_worker',
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
        state: 'queued',
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

    try {
        if (!attemptId) {
            throw new Error('Retry attempt could not be initialized.');
        }
        const prompt = buildRetryPromptFromSnapshot(snapshot);
        const enqueueSucceeded = await enqueueAsyncTripGenerationJob({
            flow: snapshot.flow,
            tripId: trip.id,
            attemptId,
            requestId,
            source: options.source,
            queueRequestId: null,
            startDate: snapshot.startDate || trip.startDate,
            roundTrip: resolveRetryRoundTrip(snapshot, trip),
            prompt,
            provider: retryModel.provider,
            model: retryModel.model,
            inputSnapshot: snapshot,
            maxRetries: 0,
        });
        if (!enqueueSucceeded) {
            throw new Error('Could not enqueue async generation retry.');
        }

        return {
            state: 'queued',
            trip: runningTripWithCanonicalAttempt,
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
    }
};

export const getRetryFlowFromTrip = (trip: ITrip): TripGenerationFlow | null => {
    const flow = trip.aiMeta?.generation?.inputSnapshot?.flow;
    return flow === 'classic' || flow === 'wizard' || flow === 'surprise' ? flow : null;
};
