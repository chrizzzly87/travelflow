import type { TripGenerationFlow, TripGenerationInputSnapshot } from '../types';
import { supabase } from './supabaseClient';

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
    if (typeof window === 'undefined') return false;
    if (!supabase) return false;

    let accessToken = '';
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) return false;
        accessToken = data.session?.access_token || '';
    } catch {
        return false;
    }
    if (!accessToken) return false;

    try {
        const response = await fetch('/api/internal/ai/generation-enqueue', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
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
            }),
            keepalive: true,
        });
        if (!response.ok) return false;

        const payload = await response.json().catch(() => null) as {
            ok?: boolean;
            job?: { state?: string | null } | null;
        } | null;
        const state = payload?.job?.state || null;
        if (payload?.ok !== true) return false;
        return state === 'queued' || state === 'leased' || state === 'completed';
    } catch {
        return false;
    }
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
