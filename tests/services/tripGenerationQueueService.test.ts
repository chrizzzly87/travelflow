import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ITrip } from '../../types';

const claimRpcMock = vi.fn();
const fromUpdateEqMock = vi.fn().mockResolvedValue({ data: null, error: null });
const fromUpdateMock = vi.fn(() => ({ eq: fromUpdateEqMock }));
const fromMock = vi.fn(() => ({ update: fromUpdateMock }));

const ensureDbSessionMock = vi.fn().mockResolvedValue(undefined);
const dbUpsertTripMock = vi.fn().mockResolvedValue('trip-queued-1');
const dbCreateTripVersionMock = vi.fn().mockResolvedValue('version-1');

const generateTripFromInputSnapshotMock = vi.fn();
const buildClassicItineraryPromptMock = vi.fn().mockReturnValue('classic prompt');
const enqueueTripGenerationJobMock = vi.fn().mockResolvedValue({ id: 'job-1' });
const isClassicAsyncGenerationEnabledMock = vi.fn().mockReturnValue(false);
const startAttemptLogMock = vi.fn().mockResolvedValue({ id: 'attempt-log-1' });
const finishAttemptLogMock = vi.fn().mockResolvedValue(undefined);
const beginAbortTelemetryMock = vi.fn(() => ({ cancel: vi.fn() }));

vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => claimRpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

vi.mock('../../services/dbService', () => ({
  ensureDbSession: (...args: unknown[]) => ensureDbSessionMock(...args),
  dbUpsertTrip: (...args: unknown[]) => dbUpsertTripMock(...args),
  dbCreateTripVersion: (...args: unknown[]) => dbCreateTripVersionMock(...args),
}));

vi.mock('../../services/aiService', () => ({
  generateTripFromInputSnapshot: (...args: unknown[]) => generateTripFromInputSnapshotMock(...args),
  buildClassicItineraryPrompt: (...args: unknown[]) => buildClassicItineraryPromptMock(...args),
}));

vi.mock('../../services/tripGenerationAttemptLogService', () => ({
  startTripGenerationAttemptLog: (...args: unknown[]) => startAttemptLogMock(...args),
  finishTripGenerationAttemptLog: (...args: unknown[]) => finishAttemptLogMock(...args),
}));

vi.mock('../../services/tripGenerationJobService', () => ({
  enqueueTripGenerationJob: (...args: unknown[]) => enqueueTripGenerationJobMock(...args),
}));

vi.mock('../../services/tripGenerationAsyncConfig', () => ({
  isClassicAsyncGenerationEnabled: () => isClassicAsyncGenerationEnabledMock(),
}));

vi.mock('../../services/tripGenerationAbortTelemetryService', () => ({
  beginTripGenerationAbortTelemetry: (...args: unknown[]) => beginAbortTelemetryMock(...args),
}));

vi.mock('../../utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils')>();
  return {
    ...actual,
    generateTripId: () => 'trip-queued-1',
  };
});

import {
  processQueuedTripGenerationAfterAuth,
  QueuedTripGenerationError,
} from '../../services/tripGenerationQueueService';

describe('processQueuedTripGenerationAfterAuth', () => {
  beforeEach(() => {
    claimRpcMock.mockReset();
    fromMock.mockClear();
    fromUpdateMock.mockClear();
    fromUpdateEqMock.mockClear();
    ensureDbSessionMock.mockClear();
    dbUpsertTripMock.mockClear();
    dbCreateTripVersionMock.mockClear();
    generateTripFromInputSnapshotMock.mockReset();
    buildClassicItineraryPromptMock.mockClear();
    enqueueTripGenerationJobMock.mockReset();
    isClassicAsyncGenerationEnabledMock.mockReset();
    isClassicAsyncGenerationEnabledMock.mockReturnValue(false);
    startAttemptLogMock.mockClear();
    finishAttemptLogMock.mockClear();
    beginAbortTelemetryMock.mockClear();

    claimRpcMock.mockImplementation((fn: string) => {
      if (fn === 'claim_trip_generation_request') {
        return Promise.resolve({
          data: {
            request_id: 'request-1',
            flow: 'classic',
            payload: {
              version: 1,
              flow: 'classic',
              destinationLabel: 'Barcelona',
              destinationPrompt: 'Barcelona',
              startDate: '2026-04-10',
              endDate: '2026-04-14',
              options: {},
            },
            status: 'queued',
            owner_user_id: 'owner-1',
            expires_at: new Date(Date.now() + 60_000).toISOString(),
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  it('keeps a discoverable failed trip and surfaces its tripId on queue failure', async () => {
    generateTripFromInputSnapshotMock.mockRejectedValue(new Error('Provider timeout while generating itinerary'));

    await expect(processQueuedTripGenerationAfterAuth('request-1')).rejects.toMatchObject({
      name: 'QueuedTripGenerationError',
      tripId: 'trip-queued-1',
    } satisfies Partial<QueuedTripGenerationError>);

    expect(dbUpsertTripMock).toHaveBeenCalled();

    const persistedTrips = dbUpsertTripMock.mock.calls.map((call) => call[0] as ITrip);
    const failedPersistedTrip = persistedTrips[persistedTrips.length - 1];

    expect(failedPersistedTrip.id).toBe('trip-queued-1');
    expect(failedPersistedTrip.title).toBe('Barcelona');
    expect(failedPersistedTrip.aiMeta?.generation?.state).toBe('failed');
    expect(failedPersistedTrip.aiMeta?.generation?.latestAttempt?.errorMessage).toContain('Provider timeout');
    expect(failedPersistedTrip.items.some((item) => item.loading)).toBe(false);
  });

  it('enqueues classic queue-claim work into async worker when async flag is enabled', async () => {
    isClassicAsyncGenerationEnabledMock.mockReturnValue(true);
    enqueueTripGenerationJobMock.mockResolvedValue({
      id: 'job-1',
      tripId: 'trip-queued-1',
      ownerId: 'owner-1',
      attemptId: 'attempt-log-1',
      state: 'queued',
      priority: 100,
      retryCount: 0,
      maxRetries: 0,
      runAfter: new Date().toISOString(),
      leaseExpiresAt: null,
      leasedBy: null,
      payload: {},
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await processQueuedTripGenerationAfterAuth('request-1');

    expect(result.tripId).toBe('trip-queued-1');
    expect(result.trip.aiMeta?.generation?.state).toBe('queued');
    expect(generateTripFromInputSnapshotMock).not.toHaveBeenCalled();
    expect(enqueueTripGenerationJobMock).toHaveBeenCalledTimes(1);
    expect(startAttemptLogMock).toHaveBeenCalledWith(expect.objectContaining({
      state: 'queued',
      source: 'queue_claim_async',
    }));
  });
});
