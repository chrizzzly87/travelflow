import { afterEach, describe, expect, it, vi } from 'vitest';

import { config, handler } from '../../netlify/functions/ai-generate-worker-cron.js';

const ORIGINAL_ENV = { ...process.env };

describe('netlify/functions/ai-generate-worker-cron', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('skips when async worker is disabled', async () => {
    process.env.AI_GENERATION_ASYNC_WORKER_ENABLED = 'false';
    process.env.TF_ADMIN_API_KEY = 'secret';
    process.env.URL = 'https://travelflowapp.netlify.app';

    const response = await handler();
    const payload = JSON.parse(String(response.body));

    expect(config.schedule).toBe('*/1 * * * *');
    expect(response.statusCode).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      skipped: true,
      reason: 'worker_disabled',
    });
  });

  it('triggers the background worker endpoint with admin auth', async () => {
    process.env.AI_GENERATION_ASYNC_WORKER_ENABLED = 'true';
    process.env.TF_ADMIN_API_KEY = 'secret';
    process.env.URL = 'https://travelflowapp.netlify.app';
    process.env.AI_GENERATION_ASYNC_WORKER_BATCH = '3';

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, accepted: true }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler();
    const payload = JSON.parse(String(response.body));

    expect(response.statusCode).toBe(202);
    expect(payload).toEqual({ ok: true, accepted: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://travelflowapp.netlify.app/.netlify/functions/ai-generate-worker-background');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'x-tf-admin-key': 'secret',
      'x-tf-worker-cron': '1',
    });
    expect(init.body).toBe(JSON.stringify({ limit: 3 }));
  });
});
