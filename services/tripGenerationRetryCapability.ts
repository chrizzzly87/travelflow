import type { TripGenerationState } from '../types';

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
