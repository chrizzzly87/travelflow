import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const envGetMock = vi.fn();

import handler from '../../netlify/edge-functions/ai-generate-enqueue.ts';

describe('netlify/edge-functions/ai-generate-enqueue', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        envGetMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
        vi.stubGlobal('Deno', {
            env: {
                get: (...args: unknown[]) => envGetMock(...args),
            },
        });
        envGetMock.mockImplementation((key: string) => {
            if (key === 'VITE_SUPABASE_URL') return 'https://supabase.example';
            if (key === 'VITE_SUPABASE_ANON_KEY') return 'anon-key';
            if (key === 'TF_ADMIN_API_KEY') return 'admin-key';
            return '';
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('requires a bearer token', async () => {
        const response = await handler(new Request('https://travelflowapp.netlify.app/api/internal/ai/generation-enqueue', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tripId: 'trip-1',
                attemptId: 'attempt-1',
            }),
        }));

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toMatchObject({
            ok: false,
            code: 'AUTH_TOKEN_MISSING',
        });
    });

    it('enqueues the job with bearer auth and dispatches the background worker', async () => {
        fetchMock
            .mockResolvedValueOnce(new Response(JSON.stringify([{
                id: 'job-1',
                trip_id: 'trip-1',
                attempt_id: 'attempt-1',
                state: 'queued',
            }]), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                ok: true,
                accepted: true,
            }), {
                status: 202,
                headers: { 'Content-Type': 'application/json' },
            }));

        const response = await handler(new Request('https://travelflowapp.netlify.app/api/internal/ai/generation-enqueue', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer user-token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tripId: 'trip-1',
                attemptId: 'attempt-1',
                payload: {
                    flow: 'classic',
                },
                priority: 25,
                maxRetries: 0,
            }),
        }));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            ok: true,
            job: {
                id: 'job-1',
                tripId: 'trip-1',
                attemptId: 'attempt-1',
                state: 'queued',
            },
            dispatchAccepted: true,
            dispatchStatus: 202,
        });
        expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://supabase.example/rest/v1/rpc/trip_generation_job_enqueue', expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
                apikey: 'anon-key',
                Authorization: 'Bearer user-token',
            }),
        }));
        expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://travelflowapp.netlify.app/.netlify/functions/ai-generate-worker-background', expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
                'x-tf-admin-key': 'admin-key',
            }),
        }));
    });

    it('keeps the enqueue successful when immediate background dispatch fails', async () => {
        fetchMock
            .mockResolvedValueOnce(new Response(JSON.stringify([{
                id: 'job-1',
                trip_id: 'trip-1',
                attempt_id: 'attempt-1',
                state: 'queued',
            }]), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                ok: false,
                error: 'dispatch failed',
            }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' },
            }));

        const response = await handler(new Request('https://travelflowapp.netlify.app/api/internal/ai/generation-enqueue', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer user-token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tripId: 'trip-1',
                attemptId: 'attempt-1',
                payload: {
                    flow: 'classic',
                },
            }),
        }));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            ok: true,
            job: {
                id: 'job-1',
                state: 'queued',
            },
            dispatchAccepted: false,
            dispatchStatus: 502,
            dispatchError: 'dispatch failed',
        });
    });
});
