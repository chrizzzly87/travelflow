import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildAsyncWorkerHealthSummary,
  shouldRunAsyncWorkerCanary,
  waitForAsyncWorkerCanaryEvaluation,
  type AsyncWorkerCanaryContext,
  type AsyncWorkerHealthCheckRecord,
} from '../../netlify/edge-lib/async-worker-health';

const buildCheck = (overrides: Partial<AsyncWorkerHealthCheckRecord>): AsyncWorkerHealthCheckRecord => ({
  id: overrides.id || '00000000-0000-4000-8000-000000000001',
  checkType: overrides.checkType || 'heartbeat',
  status: overrides.status || 'ok',
  startedAt: overrides.startedAt || '2026-03-10T10:00:00.000Z',
  finishedAt: overrides.finishedAt ?? '2026-03-10T10:00:15.000Z',
  staleQueuedCount: overrides.staleQueuedCount ?? 0,
  oldestQueuedAgeMs: overrides.oldestQueuedAgeMs ?? null,
  dispatchAttempted: overrides.dispatchAttempted ?? true,
  dispatchHttpStatus: overrides.dispatchHttpStatus ?? 202,
  canaryLatencyMs: overrides.canaryLatencyMs ?? null,
  failureCode: overrides.failureCode ?? null,
  failureMessage: overrides.failureMessage ?? null,
  metadata: overrides.metadata ?? null,
  createdAt: overrides.createdAt || '2026-03-10T10:00:15.000Z',
});

const jsonResponse = (payload: unknown, init?: ResponseInit) => new Response(JSON.stringify(payload), {
  status: init?.status ?? 200,
  headers: {
    'Content-Type': 'application/json',
    ...(init?.headers || {}),
  },
});

const buildCanary = (overrides: Partial<AsyncWorkerCanaryContext> = {}): AsyncWorkerCanaryContext => ({
  tripId: overrides.tripId || 'internal-canary-trip',
  attemptId: overrides.attemptId || 'internal-canary-attempt',
  jobId: overrides.jobId || 'internal-canary-job',
  ownerId: overrides.ownerId || '00000000-0000-4000-8000-000000000001',
  requestId: overrides.requestId || 'async-worker-canary-request',
  startedAt: overrides.startedAt || '2026-03-10T10:00:00.000Z',
});

describe('async worker health helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('does not schedule a canary when a successful one completed inside the cadence window', () => {
    const recentSuccess = buildCheck({
      checkType: 'canary',
      status: 'ok',
      startedAt: '2026-03-10T10:00:00.000Z',
      finishedAt: '2026-03-10T10:00:30.000Z',
    });

    expect(shouldRunAsyncWorkerCanary([recentSuccess], Date.parse('2026-03-10T10:10:00.000Z'))).toBe(false);
  });

  it('marks summary as failed when the latest heartbeat is stale', () => {
    const summary = buildAsyncWorkerHealthSummary([
      buildCheck({
        checkType: 'heartbeat',
        status: 'ok',
        startedAt: '2026-03-10T10:00:00.000Z',
      }),
      buildCheck({
        id: '00000000-0000-4000-8000-000000000002',
        checkType: 'canary',
        status: 'ok',
        startedAt: '2026-03-10T10:01:00.000Z',
        finishedAt: '2026-03-10T10:01:10.000Z',
        canaryLatencyMs: 250,
      }),
    ], Date.parse('2026-03-10T10:05:30.000Z'));

    expect(summary.overallStatus).toBe('failed');
    expect(summary.statusReason).toContain('heartbeat');
  });

  it('marks summary as warning when stale queued jobs were re-kicked successfully', () => {
    const summary = buildAsyncWorkerHealthSummary([
      buildCheck({
        checkType: 'heartbeat',
        status: 'warning',
        startedAt: '2026-03-10T10:00:00.000Z',
        staleQueuedCount: 3,
        oldestQueuedAgeMs: 420000,
        failureMessage: 'Detected stale queued jobs and re-kicked the worker.',
        metadata: {
          selfHealAttempted: true,
          selfHealSucceeded: true,
        },
      }),
      buildCheck({
        id: '00000000-0000-4000-8000-000000000003',
        checkType: 'canary',
        status: 'ok',
        startedAt: '2026-03-10T09:55:00.000Z',
        finishedAt: '2026-03-10T09:55:01.000Z',
        canaryLatencyMs: 120,
      }),
    ], Date.parse('2026-03-10T10:01:00.000Z'));

    expect(summary.overallStatus).toBe('warning');
    expect(summary.staleQueuedCount).toBe(3);
    expect(summary.lastSelfHealStatus).toBe('warning');
  });

  it('waits for a queued canary to become terminal before marking it failed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T10:10:00.000Z'));

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{
        id: 'internal-canary-job',
        state: 'queued',
        last_error_code: null,
        last_error_message: null,
        leased_by: null,
        updated_at: '2026-03-10T10:10:00.000Z',
        finished_at: null,
      }], { status: 200 }))
      .mockResolvedValueOnce(jsonResponse([{
        id: 'internal-canary-job',
        state: 'failed',
        last_error_code: 'ASYNC_WORKER_PAYLOAD_INVALID',
        last_error_message: 'Job payload is invalid for async generation worker.',
        leased_by: 'worker-1',
        updated_at: '2026-03-10T10:10:01.000Z',
        finished_at: '2026-03-10T10:10:01.000Z',
      }], { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const evaluationPromise = waitForAsyncWorkerCanaryEvaluation(
      { url: 'https://supabase.example', serviceRoleKey: 'service-role-secret' },
      buildCanary(),
      { maxWaitMs: 2_000, pollIntervalMs: 1_000 },
    );

    await vi.advanceTimersByTimeAsync(1_000);
    const evaluation = await evaluationPromise;

    expect(evaluation).toMatchObject({
      status: 'ok',
      failureCode: null,
      errorCode: 'ASYNC_WORKER_PAYLOAD_INVALID',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
