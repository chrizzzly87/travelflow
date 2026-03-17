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

const isLocalDevRuntime = (): boolean => {
    if (typeof window === 'undefined') return false;
    const hostname = window.location?.hostname?.trim().toLowerCase() || '';
    return hostname === 'localhost' || hostname === '127.0.0.1';
};

const warnLocalDevEnqueueFailure = (message: string): void => {
    if (!isLocalDevRuntime()) return;
    console.warn(message);
};

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
        if (!response.ok) {
            const responseText = await response.text().catch(() => '');
            const looksLikeViteNotFoundPage = response.status === 404
                && /<\s*html|<\s*!doctype\s+html/i.test(responseText);
            const looksLikeViteProxyFailure = response.status === 500
                && (!responseText.trim() || responseText.trim() === 'Internal Server Error');
            if (looksLikeViteNotFoundPage) {
                warnLocalDevEnqueueFailure(
                    'Trip generation enqueue route is unavailable in Vite-only dev. Start `pnpm dev:netlify` and either open http://localhost:8888 or keep it running while using http://localhost:5173.',
                );
            } else if (looksLikeViteProxyFailure) {
                warnLocalDevEnqueueFailure(
                    'Vite could not reach Netlify dev for trip generation enqueue requests (connection refused on localhost:8888). Start `pnpm dev:netlify` before testing async trip generation.',
                );
            }
            return false;
        }

        const payload = await response.json().catch(() => null) as {
            ok?: boolean;
            job?: { state?: string | null } | null;
        } | null;
        const state = payload?.job?.state || null;
        if (payload?.ok !== true) return false;
        return state === 'queued' || state === 'leased' || state === 'completed';
    } catch {
        warnLocalDevEnqueueFailure(
            'Trip generation enqueue request failed in local dev. Ensure `pnpm dev:netlify` is running for `/api/internal/ai/generation-enqueue`.',
        );
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
