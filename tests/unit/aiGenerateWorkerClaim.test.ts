import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleGenerationWorkerRequest } from '../../netlify/edge-functions/ai-generate-worker.ts';

const stubDenoEnv = (values: Record<string, string | undefined>) => {
  vi.stubGlobal('Deno', {
    env: {
      get: (key: string) => values[key],
    },
  });
};

describe('ai-generate-worker claim handling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns explicit claim failure payload when claim RPC fails', async () => {
    stubDenoEnv({
      AI_GENERATION_ASYNC_WORKER_ENABLED: 'true',
      TF_ADMIN_API_KEY: 'expected-key',
      VITE_SUPABASE_URL: 'https://supabase.example',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'trip_generation_job_claim failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://travelflowapp.netlify.app/api/internal/ai/generation-worker?limit=2', {
      method: 'POST',
      headers: {
        'x-tf-admin-key': 'expected-key',
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    const response = await handleGenerationWorkerRequest(request);
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toMatchObject({
      ok: false,
      code: 'WORKER_JOB_CLAIM_FAILED',
      error: 'trip_generation_job_claim failed',
      status: 500,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('allows authenticated user bearer token to trigger a single-job claim', async () => {
    stubDenoEnv({
      AI_GENERATION_ASYNC_WORKER_ENABLED: 'true',
      VITE_SUPABASE_URL: 'https://supabase.example',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: '11111111-1111-4111-8111-111111111111' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://travelflowapp.netlify.app/api/internal/ai/generation-worker?limit=3', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer user-token',
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    const response = await handleGenerationWorkerRequest(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      auth_mode: 'user',
      claimed: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const claimCall = fetchMock.mock.calls[2];
    expect(String(claimCall[0])).toContain('/rest/v1/rpc/trip_generation_job_claim');
    expect(JSON.parse(String(claimCall[1]?.body))).toMatchObject({
      p_limit: 1,
    });
  });
});
