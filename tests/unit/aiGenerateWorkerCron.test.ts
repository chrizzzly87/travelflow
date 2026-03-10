import { afterEach, describe, expect, it, vi } from 'vitest';

import { config, handler } from '../../netlify/functions/ai-generate-worker-cron.js';

const ORIGINAL_ENV = { ...process.env };

const jsonResponse = (payload: unknown, init?: ResponseInit) => new Response(JSON.stringify(payload), {
  status: init?.status ?? 200,
  headers: {
    'Content-Type': 'application/json',
    ...(init?.headers || {}),
  },
});

describe('netlify/functions/ai-generate-worker-cron', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
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

  it('triggers the background worker and persists a healthy heartbeat when no stale queue is detected', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T10:10:00.000Z'));
    process.env.AI_GENERATION_ASYNC_WORKER_ENABLED = 'true';
    process.env.TF_ADMIN_API_KEY = 'secret';
    process.env.URL = 'https://travelflowapp.netlify.app';
    process.env.VITE_SUPABASE_URL = 'https://supabase.example';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';
    process.env.AI_GENERATION_ASYNC_WORKER_BATCH = '3';

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{
        id: '00000000-0000-4000-8000-000000000010',
        check_type: 'canary',
        status: 'ok',
        started_at: '2026-03-10T10:00:00.000Z',
        finished_at: '2026-03-10T10:00:10.000Z',
        stale_queued_count: 0,
        oldest_queued_age_ms: null,
        dispatch_attempted: false,
        dispatch_http_status: null,
        canary_latency_ms: 180,
        failure_code: null,
        failure_message: null,
        metadata: {},
        created_at: '2026-03-10T10:00:10.000Z',
      }], { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('[]', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'content-range': '0-0/0',
        },
      }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, accepted: true }, { status: 202 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler();
    const payload = JSON.parse(String(response.body));

    expect(response.statusCode).toBe(202);
    expect(payload).toMatchObject({
      ok: true,
      accepted: true,
      health: {
        status: 'ok',
        staleQueuedCount: 0,
        selfHealAttempted: false,
      },
    });

    const backgroundCall = fetchMock.mock.calls[3] as [string, RequestInit];
    expect(backgroundCall[0]).toBe('https://travelflowapp.netlify.app/.netlify/functions/ai-generate-worker-background');
    expect(backgroundCall[1].headers).toMatchObject({
      'x-tf-admin-key': 'secret',
      'x-tf-worker-cron': '1',
    });
    expect(backgroundCall[1].body).toBe(JSON.stringify({ limit: 3 }));

    const heartbeatInsert = fetchMock.mock.calls[4] as [string, RequestInit];
    expect(heartbeatInsert[0]).toBe('https://supabase.example/rest/v1/async_worker_health_checks');
    expect(JSON.parse(String(heartbeatInsert[1].body))).toMatchObject({
      check_type: 'heartbeat',
      status: 'ok',
      stale_queued_count: 0,
      dispatch_attempted: true,
      dispatch_http_status: 202,
    });
  });

  it('records watchdog and canary rows when stale queued jobs are detected', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T10:10:00.000Z'));
    process.env.AI_GENERATION_ASYNC_WORKER_ENABLED = 'true';
    process.env.TF_ADMIN_API_KEY = 'secret';
    process.env.URL = 'https://travelflowapp.netlify.app';
    process.env.VITE_SUPABASE_URL = 'https://supabase.example';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';
    process.env.AI_GENERATION_ASYNC_WORKER_BATCH = '1';

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([], { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'job-1', updated_at: '2026-03-10T10:00:00.000Z' }]), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'content-range': '0-0/2',
        },
      }))
      .mockResolvedValueOnce(jsonResponse([{ user_id: '00000000-0000-4000-8000-000000000099' }], { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, accepted: true }, { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'job-1', updated_at: '2026-03-10T10:04:00.000Z' }]), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'content-range': '0-0/1',
        },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse([{
        id: 'job-canary',
        state: 'failed',
        last_error_code: 'ASYNC_WORKER_PAYLOAD_INVALID',
        last_error_message: 'Job payload is invalid for async generation worker.',
      }], { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler();
    const payload = JSON.parse(String(response.body));

    expect(response.statusCode).toBe(202);
    expect(payload.health).toMatchObject({
      status: 'warning',
      staleQueuedCount: 2,
      selfHealAttempted: true,
      selfHealSucceeded: true,
      postDispatchStaleQueuedCount: 1,
      canary: {
        status: 'ok',
        code: 'ASYNC_WORKER_PAYLOAD_INVALID',
      },
    });

    const backgroundCall = fetchMock.mock.calls[7] as [string, RequestInit];
    expect(backgroundCall[0]).toBe('https://travelflowapp.netlify.app/.netlify/functions/ai-generate-worker-background');
    expect(backgroundCall[1].body).toBe(JSON.stringify({ limit: 2 }));

    const heartbeatInsert = fetchMock.mock.calls[9] as [string, RequestInit];
    const watchdogInsert = fetchMock.mock.calls[10] as [string, RequestInit];
    const canaryInsert = fetchMock.mock.calls[13] as [string, RequestInit];

    expect(JSON.parse(String(heartbeatInsert[1].body))).toMatchObject({
      check_type: 'heartbeat',
      status: 'warning',
      stale_queued_count: 2,
      dispatch_http_status: 202,
    });
    expect(JSON.parse(String(watchdogInsert[1].body))).toMatchObject({
      check_type: 'watchdog',
      status: 'warning',
      stale_queued_count: 2,
    });
    expect(JSON.parse(String(canaryInsert[1].body))).toMatchObject({
      check_type: 'canary',
      status: 'ok',
      canary_latency_ms: expect.any(Number),
    });
  });
});
