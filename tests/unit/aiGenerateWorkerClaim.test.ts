import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  handleGenerationWorkerRequest,
  processGenerationWorkerRequest,
} from '../../netlify/edge-functions/ai-generate-worker.ts';

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

  it('returns explicit claim failure payload when claim RPC fails during background processing', async () => {
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

    const response = await processGenerationWorkerRequest(request);
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

  it('dispatches authenticated user bearer token requests to the background worker with a single-job limit', async () => {
    stubDenoEnv({
      AI_GENERATION_ASYNC_WORKER_ENABLED: 'true',
      TF_ADMIN_API_KEY: 'expected-key',
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
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, accepted: true }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }));
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

    expect(response.status).toBe(202);
    expect(payload).toMatchObject({
      ok: true,
      accepted: true,
      auth_mode: 'user',
      limit: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const dispatchCall = fetchMock.mock.calls[1];
    expect(String(dispatchCall[0])).toContain('/.netlify/functions/ai-generate-worker-background');
    expect(JSON.parse(String(dispatchCall[1]?.body))).toMatchObject({
      limit: 1,
    });
    expect(dispatchCall[1]?.headers).toMatchObject({
      'x-tf-admin-key': 'expected-key',
      'x-tf-worker-dispatch-mode': 'user',
    });
  });

  it('returns auth diagnostics when dispatch authorization fails', async () => {
    stubDenoEnv({
      AI_GENERATION_ASYNC_WORKER_ENABLED: 'true',
      TF_ADMIN_API_KEY: 'expected-key',
      VITE_SUPABASE_URL: 'https://supabase.example',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
    });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://travelflowapp.netlify.app/api/internal/ai/generation-worker?limit=1', {
      method: 'POST',
      headers: {
        'x-tf-admin-key': 'wrong-key',
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    const response = await handleGenerationWorkerRequest(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({
      ok: false,
      code: 'WORKER_UNAUTHORIZED',
      details: {
        hasConfiguredAdminKey: true,
        configuredAdminKeyLength: 'expected-key'.length,
        providedAdminKeyLength: 'wrong-key'.length,
        hasAuthorizationHeader: false,
        bearerUserResolved: false,
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
