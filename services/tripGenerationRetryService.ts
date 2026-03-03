import { getDefaultCreateTripModel } from '../config/aiModelCatalog';
import type {
    GenerateOptions,
    SurpriseGenerateOptions,
    TripGenerationRequestContext,
    WizardGenerateOptions,
} from './aiService';
import {
    generateItinerary,
    generateSurpriseItinerary,
    generateWizardItinerary,
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
} from './tripGenerationDiagnosticsService';
import type { ITrip, TripGenerationFlow, TripGenerationInputSnapshot } from '../types';

export interface RetryTripGenerationOptions {
    source: string;
    onTripUpdate?: (trip: ITrip) => Promise<void> | void;
    contextSource?: string;
}

export interface RetryTripGenerationResult {
    trip: ITrip;
    state: 'succeeded' | 'failed';
    error?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asText = (value: unknown): string => typeof value === 'string' ? value : '';

const parseClassicSnapshot = (
    snapshot: TripGenerationInputSnapshot,
): { destinationPrompt: string; options: GenerateOptions } => {
    const payload = isRecord(snapshot.payload) ? snapshot.payload : {};
    const destinationPrompt = asText(payload.destinationPrompt).trim();
    const optionsRaw = isRecord(payload.options) ? payload.options : {};
    return {
        destinationPrompt,
        options: optionsRaw as GenerateOptions,
    };
};

const parseWizardSnapshot = (
    snapshot: TripGenerationInputSnapshot,
): WizardGenerateOptions => {
    const payload = isRecord(snapshot.payload) ? snapshot.payload : {};
    const optionsRaw = isRecord(payload.options) ? payload.options : {};
    return optionsRaw as WizardGenerateOptions;
};

const parseSurpriseSnapshot = (
    snapshot: TripGenerationInputSnapshot,
): SurpriseGenerateOptions => {
    const payload = isRecord(snapshot.payload) ? snapshot.payload : {};
    const optionsRaw = isRecord(payload.options) ? payload.options : {};
    return optionsRaw as SurpriseGenerateOptions;
};

const generateFromSnapshot = async (
    snapshot: TripGenerationInputSnapshot,
    context: TripGenerationRequestContext,
) => {
    const defaultModel = getDefaultCreateTripModel();
    const aiTarget = {
        provider: defaultModel.provider,
        model: defaultModel.model,
    };

    if (snapshot.flow === 'classic') {
        const parsed = parseClassicSnapshot(snapshot);
        if (!parsed.destinationPrompt) {
            throw new Error('Retry payload is missing destination prompt.');
        }
        return generateItinerary(parsed.destinationPrompt, snapshot.startDate, {
            ...parsed.options,
            aiTarget,
            generationContext: context,
        });
    }

    if (snapshot.flow === 'wizard') {
        const options = parseWizardSnapshot(snapshot);
        return generateWizardItinerary({
            ...options,
            aiTarget,
            generationContext: context,
        });
    }

    const options = parseSurpriseSnapshot(snapshot);
    return generateSurpriseItinerary({
        ...options,
        aiTarget,
        generationContext: context,
    });
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
    const defaultModel = getDefaultCreateTripModel();

    const runningTrip = markTripGenerationRunning(trip, {
        flow: snapshot.flow,
        source: options.source,
        inputSnapshot: snapshot,
        provider: defaultModel.provider,
        model: defaultModel.model,
        requestId,
        state: 'running',
        isRetry: true,
    });

    const runningAttempt = runningTrip.aiMeta?.generation?.latestAttempt || null;
    const attemptId = runningAttempt?.id || null;

    if (options.onTripUpdate) {
        await options.onTripUpdate(runningTrip);
    }

    const loggedAttempt = await startTripGenerationAttemptLog({
        tripId: trip.id,
        flow: snapshot.flow,
        source: options.source,
        state: 'running',
        provider: defaultModel.provider,
        model: defaultModel.model,
        requestId,
        startedAt: runningAttempt?.startedAt,
    });

    const telemetrySession = beginTripGenerationAbortTelemetry({
        tripId: trip.id,
        attemptId: loggedAttempt?.id || attemptId || 'unknown-attempt',
        requestId,
        flow: snapshot.flow,
        source: options.source,
        provider: defaultModel.provider,
        model: defaultModel.model,
    });

    try {
        const generatedTrip = await generateFromSnapshot(snapshot, {
            requestId,
            tripId: trip.id,
            attemptId: attemptId || undefined,
            flow: snapshot.flow,
            source: options.contextSource || options.source,
        });

        const merged = mergeGeneratedTripIntoExisting(runningTrip, generatedTrip);
        const succeeded = markTripGenerationSucceeded(merged, {
            flow: snapshot.flow,
            source: options.source,
            provider: generatedTrip.aiMeta?.provider || defaultModel.provider,
            model: generatedTrip.aiMeta?.model || defaultModel.model,
            providerModel: generatedTrip.aiMeta?.generation?.latestAttempt?.providerModel || null,
            requestId,
            attemptId,
            durationMs: generatedTrip.aiMeta?.generation?.latestAttempt?.durationMs || null,
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
        const failed = markTripGenerationFailed(runningTrip, {
            flow: snapshot.flow,
            source: options.source,
            error,
            provider: defaultModel.provider,
            model: defaultModel.model,
            requestId,
            attemptId,
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
