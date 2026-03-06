import { afterEach, describe, expect, it, vi } from 'vitest';

import { handler } from '../../netlify/functions/ai-generate-worker-background.js';

const ORIGINAL_ENV = { ...process.env };

describe('netlify/functions/ai-generate-worker-background', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('rejects unauthorized invocations', async () => {
    process.env.AI_GENERATION_ASYNC_WORKER_ENABLED = 'true';
    process.env.TF_ADMIN_API_KEY = 'expected-key';

    const response = await handler({
      headers: { 'x-tf-admin-key': 'wrong-key' },
      body: '{}',
    } as unknown as Parameters<typeof handler>[0]);

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(String(response.body))).toMatchObject({
      ok: false,
      code: 'WORKER_UNAUTHORIZED',
    });
  });

  it('proxies authorized invocations to the worker endpoint', async () => {
    process.env.AI_GENERATION_ASYNC_WORKER_ENABLED = 'true';
    process.env.TF_ADMIN_API_KEY = 'expected-key';
    process.env.URL = 'https://travelflowapp.netlify.app';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, processed: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler({
      headers: { 'x-tf-admin-key': 'expected-key' },
      body: JSON.stringify({ limit: 2 }),
    } as unknown as Parameters<typeof handler>[0]);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(String(response.body))).toEqual({ ok: true, processed: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://travelflowapp.netlify.app/api/internal/ai/generation-worker?limit=2');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'x-tf-admin-key': 'expected-key',
    });
  });
});
