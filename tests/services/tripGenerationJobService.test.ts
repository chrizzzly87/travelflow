import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();
const fromMock = vi.fn();
const selectMock = vi.fn();
const eqMock = vi.fn();
const inMock = vi.fn();
const orderMock = vi.fn();
const limitMock = vi.fn();
const ensureDbSessionMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

vi.mock('../../services/dbService', () => ({
  ensureDbSession: (...args: unknown[]) => ensureDbSessionMock(...args),
}));

import {
  claimTripGenerationJobs,
  enqueueTripGenerationJob,
  listTripGenerationJobsByTrip,
  requeueTripGenerationJob,
} from '../../services/tripGenerationJobService';

describe('tripGenerationJobService', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    selectMock.mockReset();
    eqMock.mockReset();
    inMock.mockReset();
    orderMock.mockReset();
    limitMock.mockReset();
    ensureDbSessionMock.mockClear();

    fromMock.mockReturnValue({
      select: (...args: unknown[]) => selectMock(...args),
    });
    selectMock.mockReturnValue({
      eq: (...args: unknown[]) => eqMock(...args),
    });
    eqMock.mockImplementation(() => ({
      in: (...args: unknown[]) => inMock(...args),
      order: (...args: unknown[]) => orderMock(...args),
    }));
    inMock.mockImplementation(() => ({
      order: (...args: unknown[]) => orderMock(...args),
    }));
    orderMock.mockImplementation(() => ({
      limit: (...args: unknown[]) => limitMock(...args),
    }));
  });

  it('enqueues a generation job and returns normalized shape', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{
        id: 'job-1',
        trip_id: 'trip-1',
        owner_id: 'owner-1',
        attempt_id: 'attempt-1',
        state: 'queued',
        priority: 80,
        retry_count: 0,
        max_retries: 3,
        run_after: '2026-03-05T10:00:00.000Z',
        lease_expires_at: null,
        leased_by: null,
        payload: { flow: 'classic' },
        last_error_code: null,
        last_error_message: null,
        created_at: '2026-03-05T09:59:59.000Z',
        updated_at: '2026-03-05T09:59:59.000Z',
      }],
      error: null,
    });

    const result = await enqueueTripGenerationJob({
      tripId: 'trip-1',
      attemptId: 'attempt-1',
      payload: { flow: 'classic' },
      priority: 80,
      maxRetries: 3,
    });

    expect(result).toMatchObject({
      id: 'job-1',
      tripId: 'trip-1',
      attemptId: 'attempt-1',
      state: 'queued',
      priority: 80,
    });

    expect(rpcMock).toHaveBeenCalledWith('trip_generation_job_enqueue', expect.objectContaining({
      p_trip_id: 'trip-1',
      p_attempt_id: 'attempt-1',
      p_payload: { flow: 'classic' },
      p_priority: 80,
      p_max_retries: 3,
    }));
    expect(ensureDbSessionMock).toHaveBeenCalled();
  });

  it('claims leased jobs and filters invalid rows', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          id: 'job-2',
          trip_id: 'trip-2',
          owner_id: 'owner-2',
          attempt_id: 'attempt-2',
          state: 'leased',
          priority: 100,
          retry_count: 1,
          max_retries: 3,
          run_after: '2026-03-05T10:00:00.000Z',
          lease_expires_at: '2026-03-05T10:02:00.000Z',
          leased_by: 'worker-1',
          payload: { flow: 'classic' },
          created_at: '2026-03-05T09:59:59.000Z',
          updated_at: '2026-03-05T10:00:00.000Z',
        },
        {
          id: null,
          trip_id: 'trip-invalid',
          owner_id: 'owner-invalid',
          attempt_id: 'attempt-invalid',
          state: 'queued',
          run_after: '2026-03-05T10:00:00.000Z',
          created_at: '2026-03-05T09:59:59.000Z',
          updated_at: '2026-03-05T09:59:59.000Z',
        },
      ],
      error: null,
    });

    const result = await claimTripGenerationJobs('worker-1', { limit: 2, leaseSeconds: 120 });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'job-2',
      state: 'leased',
      leasedBy: 'worker-1',
    });

    expect(rpcMock).toHaveBeenCalledWith('trip_generation_job_claim', {
      p_worker_id: 'worker-1',
      p_limit: 2,
      p_lease_seconds: 120,
    });
  });

  it('lists trip generation jobs for a trip and supports state filtering', async () => {
    limitMock.mockResolvedValueOnce({
      data: [
        {
          id: 'job-3',
          trip_id: 'trip-3',
          owner_id: 'owner-3',
          attempt_id: 'attempt-3',
          state: 'dead',
          priority: 100,
          retry_count: 3,
          max_retries: 3,
          run_after: '2026-03-05T10:00:00.000Z',
          lease_expires_at: null,
          leased_by: null,
          payload: { flow: 'classic' },
          last_error_code: 'ASYNC_WORKER_PROVIDER_FAILED',
          last_error_message: 'Provider failed',
          created_at: '2026-03-05T09:59:59.000Z',
          updated_at: '2026-03-05T10:00:00.000Z',
        },
      ],
      error: null,
    });

    const rows = await listTripGenerationJobsByTrip('trip-3', {
      limit: 10,
      states: ['dead', 'failed'],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'job-3',
      tripId: 'trip-3',
      state: 'dead',
      retryCount: 3,
      lastErrorCode: 'ASYNC_WORKER_PROVIDER_FAILED',
    });
    expect(fromMock).toHaveBeenCalledWith('trip_generation_jobs');
    expect(eqMock).toHaveBeenCalledWith('trip_id', 'trip-3');
    expect(inMock).toHaveBeenCalledWith('state', ['dead', 'failed']);
    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limitMock).toHaveBeenCalledWith(10);
  });

  it('requeues a dead-letter job for admin operations', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{
        id: 'job-9',
        state: 'queued',
      }],
      error: null,
    });

    const success = await requeueTripGenerationJob('job-9', {
      reason: 'admin_drawer_manual_requeue',
      resetRetryCount: true,
    });

    expect(success).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith('trip_generation_job_requeue', {
      p_job_id: 'job-9',
      p_reason: 'admin_drawer_manual_requeue',
      p_run_after: null,
      p_reset_retry_count: true,
    });
  });
});
