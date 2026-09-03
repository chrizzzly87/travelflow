import type { ITrip } from '../types';
import type { TripAgentContextRef, TripAgentMessage, TripAgentQuotaState } from '../shared/tripAgent';
import { dbGetAccessToken } from './dbService';

export interface TripAgentThread {
    id: string;
    tripId: string;
    title: string;
    status: 'active' | 'archived';
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface TripAgentBootstrap {
    actor: { userId: string; label: string; isAdmin: boolean };
    threads: TripAgentThread[];
    currentThreadId: string | null;
    messages: TripAgentMessage[];
    quota: TripAgentQuotaState;
}

const authenticatedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const token = await dbGetAccessToken();
    if (!token) throw new Error('Create an account to plan with AI.');
    const response = await fetch(input, {
        ...init,
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            ...(init?.headers || {}),
        },
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string; code?: string };
        const error = new Error(payload.error || `Trip Agent request failed (${response.status}).`) as Error & { code?: string; status?: number };
        error.code = payload.code;
        error.status = response.status;
        throw error;
    }
    return response;
};

export const tripAgentFetch = authenticatedFetch;

export const loadTripAgentBootstrap = async (tripId: string, threadId?: string | null): Promise<TripAgentBootstrap> => {
    const params = new URLSearchParams({ tripId });
    if (threadId) params.set('threadId', threadId);
    const response = await authenticatedFetch(`/api/trip-agent?${params.toString()}`);
    return response.json() as Promise<TripAgentBootstrap>;
};

const mutate = async <T>(body: Record<string, unknown>): Promise<T> => {
    const response = await authenticatedFetch('/api/trip-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return response.json() as Promise<T>;
};

export const createTripAgentThread = async (tripId: string): Promise<TripAgentThread> => {
    const result = await mutate<{ thread: TripAgentThread }>({ action: 'createThread', tripId });
    return result.thread;
};

export const archiveTripAgentThread = (tripId: string, threadId: string): Promise<{ ok: true }> =>
    mutate({ action: 'archiveThread', tripId, threadId });

export const rejectTripAgentProposal = (tripId: string, changeSetId: string): Promise<{ ok: true }> =>
    mutate({ action: 'reject', tripId, changeSetId });

export const applyTripAgentProposal = (
    tripId: string,
    changeSetId: string,
    selectedOperationIds: string[],
): Promise<{
    trip: ITrip;
    versionId: string;
    status: 'applied' | 'applied_partial';
    appliedOperationIds: string[];
    noOpOperationIds: string[];
}> => mutate({ action: 'apply', tripId, changeSetId, selectedOperationIds });

export const buildTripAgentChatRequest = (input: {
    tripId: string;
    threadId: string;
    messages: TripAgentMessage[];
    contextRefs: TripAgentContextRef[];
}) => ({
    body: {
        action: 'chat',
        tripId: input.tripId,
        threadId: input.threadId,
        requestId: crypto.randomUUID(),
        message: input.messages.at(-1),
        contextRefs: input.contextRefs,
    },
});
