import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('../../services/supabaseClient', () => ({
    supabase: {
        auth: {
            getSession: (...args: unknown[]) => getSessionMock(...args),
        },
    },
}));

import { enqueueAsyncTripGenerationJob } from '../../services/tripGenerationAsyncEnqueueService';

describe('tripGenerationAsyncEnqueueService', () => {
    beforeEach(() => {
        getSessionMock.mockReset();
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
        vi.stubGlobal('window', {
            localStorage: {
                clear: vi.fn(),
            },
            sessionStorage: {
                clear: vi.fn(),
            },
        });

        getSessionMock.mockResolvedValue({
            data: {
                session: {
                    access_token: 'session-token',
                },
            },
            error: null,
        });
    });

    it('enqueues through the internal edge endpoint and accepts queued jobs even if dispatch falls back to cron', async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
            ok: true,
            job: {
                id: 'job-1',
                tripId: 'trip-1',
                attemptId: 'attempt-1',
                state: 'queued',
            },
            dispatchAccepted: false,
            dispatchStatus: 502,
            dispatchError: 'Background worker dispatch failed.',
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));

        const result = await enqueueAsyncTripGenerationJob({
            flow: 'classic',
            tripId: 'trip-1',
            attemptId: 'attempt-1',
            requestId: 'request-1',
            source: 'create_trip',
            startDate: '2026-07-01',
            roundTrip: true,
            prompt: 'prompt body',
            provider: 'openai',
            model: 'gpt-5.4',
            inputSnapshot: {
                flow: 'classic',
                destinationLabel: 'Berlin',
                startDate: '2026-07-01',
                endDate: '2026-07-04',
                payload: {
                    destinationPrompt: 'Berlin',
                    options: {},
                },
            },
        });

        expect(result).toBe(true);
        expect(fetchMock).toHaveBeenCalledWith('/api/internal/ai/generation-enqueue', expect.objectContaining({
            method: 'POST',
            keepalive: true,
            headers: expect.objectContaining({
                Authorization: 'Bearer session-token',
                'Content-Type': 'application/json',
            }),
        }));
    });

    it('returns false when the browser session token is unavailable', async () => {
        getSessionMock.mockResolvedValueOnce({
            data: {
                session: null,
            },
            error: null,
        });

        const result = await enqueueAsyncTripGenerationJob({
            flow: 'classic',
            tripId: 'trip-1',
            attemptId: 'attempt-1',
            requestId: 'request-1',
            source: 'create_trip',
            startDate: '2026-07-01',
            roundTrip: true,
            prompt: 'prompt body',
            provider: 'openai',
            model: 'gpt-5.4',
            inputSnapshot: {
                flow: 'classic',
                destinationLabel: 'Berlin',
                startDate: '2026-07-01',
                endDate: '2026-07-04',
                payload: {
                    destinationPrompt: 'Berlin',
                    options: {},
                },
            },
        });

        expect(result).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
