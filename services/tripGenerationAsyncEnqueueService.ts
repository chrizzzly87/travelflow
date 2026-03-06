import type { TripGenerationFlow, TripGenerationInputSnapshot } from '../types';
import { enqueueTripGenerationJob } from './tripGenerationJobService';

interface EnqueueAsyncTripGenerationInput {
    flow: TripGenerationFlow;
    tripId: string;
    attemptId: string;
    startedAt?: string | null;
    requestId: string;
    source: string;
    queueRequestId?: string | null;
    startDate: string;
    roundTrip: boolean;
    prompt: string;
    provider: string;
    model: string;
    inputSnapshot: TripGenerationInputSnapshot;
    maxRetries?: number;
    priority?: number;
}

export const enqueueAsyncTripGenerationJob = async (
    input: EnqueueAsyncTripGenerationInput,
): Promise<boolean> => {
    const enqueueResult = await enqueueTripGenerationJob({
        tripId: input.tripId,
        attemptId: input.attemptId,
        maxRetries: input.maxRetries ?? 0,
        priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 25,
        payload: {
            version: 1,
            flow: input.flow,
            source: input.source,
            requestId: input.requestId,
            queueRequestId: input.queueRequestId || null,
            tripId: input.tripId,
            attemptId: input.attemptId,
            startedAt: input.startedAt || null,
            startDate: input.startDate,
            roundTrip: input.roundTrip,
            prompt: input.prompt,
            target: {
                provider: input.provider,
                model: input.model,
            },
            inputSnapshot: input.inputSnapshot,
        },
    });

    return Boolean(enqueueResult?.id);
};

type EnqueueClassicAsyncTripGenerationInput = Omit<EnqueueAsyncTripGenerationInput, 'flow'>;

export const enqueueClassicAsyncTripGenerationJob = async (
    input: EnqueueClassicAsyncTripGenerationInput,
): Promise<boolean> => {
    return enqueueAsyncTripGenerationJob({
        ...input,
        flow: 'classic',
    });
};
