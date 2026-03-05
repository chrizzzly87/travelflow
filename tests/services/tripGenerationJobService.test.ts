import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();
const ensureExistingDbSessionMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

vi.mock('../../services/dbService', () => ({
  ensureExistingDbSession: (...args: unknown[]) => ensureExistingDbSessionMock(...args),
}));

import { claimTripGenerationJobs, enqueueTripGenerationJob } from '../../services/tripGenerationJobService';

describe('tripGenerationJobService', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    ensureExistingDbSessionMock.mockClear();
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
});
