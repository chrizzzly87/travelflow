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
    listOwnerTripGenerationAttempts,
    startTripGenerationAttemptLog,
} from './tripGenerationAttemptLogService';
import {
    createTripGenerationRequestId,
    getTripGenerationState,
    markTripGenerationFailed,
    markTripGenerationRunning,
    withLatestTripGenerationAttemptId,
} from './tripGenerationDiagnosticsService';
import type { ITrip, TripGenerationFlow, TripGenerationInputSnapshot, TripGenerationState } from '../types';
import { enqueueAsyncTripGenerationJob } from './tripGenerationAsyncEnqueueService';
import {
    dbAdminOverrideTripCommit,
    dbGetTrip,
    dbUpsertTrip,
    ensureDbSession,
} from './dbApi';
import {
    isTripGenerationJobActive,
    listTripGenerationJobsByTrip,
    triggerTripGenerationWorker,
} from './tripGenerationJobService';
import { waitForTripAttemptPersistence } from './tripGenerationPersistenceService';

export interface RetryTripGenerationOptions {
    source: string;
    onTripUpdate?: (trip: ITrip) => Promise<void> | void;
    contextSource?: string;
    modelId?: string | null;
    adminOverride?: boolean;
}

export interface RetryTripGenerationResult {
    trip: ITrip;
    state: 'queued' | 'failed';
    error?: unknown;
}

export interface TripGenerationRetryCapabilityOptions {
    canEdit: boolean;
    isAdminFallbackView?: boolean;
    adminOverrideEnabled?: boolean;
    canAdminWrite?: boolean;
    hasInputSnapshot?: boolean;
    generationState?: TripGenerationState | null;
    latestAttemptOrchestration?: string | null;
    isRetryingGeneration?: boolean;
    pendingAuthQueueRequestId?: string | null;
}

// Keep this aligned with the async worker's default provider timeout so the UI
// does not treat still-valid GPT-5.4 jobs as hard-stalled too early.
const ASYNC_WORKER_HARD_STALL_MS = 120_000;

const isLocalDevRuntime = (): boolean => {
    if (typeof window === 'undefined') return false;
    const hostname = window.location?.hostname?.trim().toLowerCase() || '';
    return hostname === 'localhost' || hostname === '127.0.0.1';
};

const canUseAdminGenerationOverride = (options: TripGenerationRetryCapabilityOptions): boolean => (
    Boolean(options.isAdminFallbackView && options.adminOverrideEnabled && options.canAdminWrite)
);

export const canTriggerTripGenerationRetry = (options: TripGenerationRetryCapabilityOptions): boolean => {
    const hasWriteAccess = options.canEdit || canUseAdminGenerationOverride(options);
    if (!hasWriteAccess) return false;
    if (options.isRetryingGeneration) return false;
    if (options.pendingAuthQueueRequestId) return false;
    if (!options.hasInputSnapshot) return false;
    return options.generationState !== 'running' && options.generationState !== 'queued';
};

export const canTriggerTripGenerationAbortAndRetry = (options: TripGenerationRetryCapabilityOptions): boolean => {
    const hasWriteAccess = options.canEdit || canUseAdminGenerationOverride(options);
    if (!hasWriteAccess) return false;
    if (options.isRetryingGeneration) return false;
    if (
        (options.generationState === 'queued' || options.generationState === 'running')
        && options.latestAttemptOrchestration === 'async_worker'
    ) {
        return false;
    }
    return Boolean(options.hasInputSnapshot);
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

const persistRetryTripState = async (
    trip: ITrip,
    options: RetryTripGenerationOptions,
): Promise<boolean> => {
    await ensureDbSession();

    if (options.adminOverride) {
        const persisted = await dbAdminOverrideTripCommit(
            trip,
            undefined,
            'Data: Admin retry state sync',
        );
        return Boolean(persisted?.tripId);
    }

    const persistedTripId = await dbUpsertTrip(trip, undefined);
    return Boolean(persistedTripId);
};

const isTerminalAttemptState = (state: string | null | undefined): boolean => (
    state === 'failed' || state === 'succeeded'
);

const isInFlightAttemptState = (state: string | null | undefined): boolean => (
    state === 'queued' || state === 'running'
);

const toMs = (value: string | null | undefined): number | null => {
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
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

    try {
        const remote = await dbGetTrip(trip.id, { includeOwnerProfile: false });
        const remoteTrip = remote?.trip || null;
        if (remoteTrip) {
            const nowMs = Date.now();
            const remoteState = getTripGenerationState(remoteTrip, nowMs);
            const remoteLatestAttempt = remoteTrip.aiMeta?.generation?.latestAttempt || null;
            const remoteLatestAttemptId = remoteLatestAttempt?.id?.trim() || null;
            let shouldReuseExistingInFlight = remoteState === 'queued' || remoteState === 'running';

            if (shouldReuseExistingInFlight && remoteLatestAttemptId) {
                try {
                    const [attemptLogs, jobs] = await Promise.all([
                        listOwnerTripGenerationAttempts(remoteTrip.id, 8),
                        listTripGenerationJobsByTrip(remoteTrip.id, { limit: 12 }),
                    ]);
                    const latestAttemptLog = attemptLogs.find((attempt) => attempt.id === remoteLatestAttemptId) || null;
                    const latestAttemptLogState = latestAttemptLog?.state || null;
                    const hasActiveJobForLatestAttempt = jobs.some((job) => (
                        job.attemptId === remoteLatestAttemptId
                        && isTripGenerationJobActive(job, nowMs)
                    ));
                    const latestAttemptStartedAtMs = toMs(latestAttemptLog?.startedAt || remoteLatestAttempt.startedAt);
                    const hasHardStalledAttempt = typeof latestAttemptStartedAtMs === 'number'
                        && nowMs - latestAttemptStartedAtMs >= ASYNC_WORKER_HARD_STALL_MS;
                    const isLikelyStaleInFlight = (
                        isInFlightAttemptState(latestAttemptLogState || remoteLatestAttempt.state || null)
                        && typeof latestAttemptStartedAtMs === 'number'
                        && (
                            !hasActiveJobForLatestAttempt
                            || hasHardStalledAttempt
                        )
                        && nowMs - latestAttemptStartedAtMs >= 20_000
                    );

                    if (isTerminalAttemptState(latestAttemptLogState) || isLikelyStaleInFlight) {
                        shouldReuseExistingInFlight = false;
                    }
                } catch {
                    const latestAttemptStartedAtMs = toMs(remoteLatestAttempt.startedAt);
                    if (
                        (remoteLatestAttempt.state === 'queued' || remoteLatestAttempt.state === 'running')
                        && typeof latestAttemptStartedAtMs === 'number'
                        && nowMs - latestAttemptStartedAtMs >= 30_000
                    ) {
                        shouldReuseExistingInFlight = false;
                    }
                }
            }

            if (shouldReuseExistingInFlight) {
                if (options.onTripUpdate) {
                    await options.onTripUpdate(remoteTrip);
                }
                void triggerTripGenerationWorker({
                    tripId: remoteTrip.id,
                    limit: 1,
                    source: 'trip_generation_retry_existing_inflight',
                    force: true,
                });
                return {
                    state: 'queued',
                    trip: remoteTrip,
                };
            }
        }
    } catch {
        // Continue with local retry flow if remote preflight fetch is unavailable.
    }

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
    const optimisticAttemptId = runningAttempt?.id || null;
    let attemptId: string | null = null;

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

        const persistedTripId = await persistRetryTripState(runningTripWithCanonicalAttempt, options);
        if (!persistedTripId) {
            throw new Error('Retry attempt could not be persisted before queueing.');
        }

        const persistedCanonicalAttempt = await waitForTripAttemptPersistence(trip.id, attemptId, {
            timeoutMs: 450,
            intervalMs: 120,
            maxAttempts: 3,
        });
        if (!persistedCanonicalAttempt) {
            throw new Error('Retry attempt could not be persisted before queueing.');
        }

        const prompt = buildRetryPromptFromSnapshot(snapshot);
        const enqueueSucceeded = await enqueueAsyncTripGenerationJob({
            flow: snapshot.flow,
            tripId: trip.id,
            attemptId,
            startedAt: loggedAttempt?.startedAt || runningAttempt?.startedAt || null,
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
            throw new Error(
                isLocalDevRuntime()
                    ? 'Could not enqueue async generation retry. In local dev, ensure `pnpm dev:netlify` is running and prefer http://localhost:8888 for async trip generation flows.'
                    : 'Could not enqueue async generation retry.',
            );
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
            attemptId: attemptId || optimisticAttemptId,
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
