import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ITrip } from '../../types';

const claimRpcMock = vi.fn();
const fromSelectMaybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
const fromSelectEqMock = vi.fn(() => ({ maybeSingle: fromSelectMaybeSingleMock }));
const fromSelectMock = vi.fn(() => ({ eq: fromSelectEqMock }));
const fromUpdateEqMock = vi.fn().mockResolvedValue({ data: null, error: null });
const fromUpdateMock = vi.fn(() => ({ eq: fromUpdateEqMock }));
const fromMock = vi.fn(() => ({ update: fromUpdateMock, select: fromSelectMock }));

const ensureDbSessionMock = vi.fn().mockResolvedValue(undefined);
const dbUpsertTripMock = vi.fn().mockResolvedValue('trip-queued-1');
const dbCreateTripVersionMock = vi.fn().mockResolvedValue('version-1');

const buildClassicItineraryPromptMock = vi.fn().mockReturnValue('classic prompt');
const buildWizardItineraryPromptMock = vi.fn().mockReturnValue('wizard prompt');
const buildSurpriseItineraryPromptMock = vi.fn().mockReturnValue('surprise prompt');
const enqueueAsyncTripGenerationJobMock = vi.fn().mockResolvedValue(true);
const startAttemptLogMock = vi.fn().mockResolvedValue({ id: 'attempt-log-1' });
const finishAttemptLogMock = vi.fn().mockResolvedValue(undefined);

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
  buildClassicItineraryPrompt: (...args: unknown[]) => buildClassicItineraryPromptMock(...args),
  buildWizardItineraryPrompt: (...args: unknown[]) => buildWizardItineraryPromptMock(...args),
  buildSurpriseItineraryPrompt: (...args: unknown[]) => buildSurpriseItineraryPromptMock(...args),
}));

vi.mock('../../services/tripGenerationAttemptLogService', () => ({
  startTripGenerationAttemptLog: (...args: unknown[]) => startAttemptLogMock(...args),
  finishTripGenerationAttemptLog: (...args: unknown[]) => finishAttemptLogMock(...args),
}));

vi.mock('../../services/tripGenerationAsyncEnqueueService', () => ({
  enqueueAsyncTripGenerationJob: (...args: unknown[]) => enqueueAsyncTripGenerationJobMock(...args),
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

const setupClassicClaim = () => {
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
};

describe('processQueuedTripGenerationAfterAuth', () => {
  beforeEach(() => {
    claimRpcMock.mockReset();
    fromMock.mockClear();
    fromSelectMock.mockClear();
    fromSelectEqMock.mockClear();
    fromSelectMaybeSingleMock.mockReset();
    fromUpdateMock.mockClear();
    fromUpdateEqMock.mockClear();
    ensureDbSessionMock.mockClear();
    dbUpsertTripMock.mockClear();
    dbCreateTripVersionMock.mockClear();
    buildClassicItineraryPromptMock.mockClear();
    buildWizardItineraryPromptMock.mockClear();
    buildSurpriseItineraryPromptMock.mockClear();
    enqueueAsyncTripGenerationJobMock.mockReset();
    startAttemptLogMock.mockClear();
    finishAttemptLogMock.mockClear();

    enqueueAsyncTripGenerationJobMock.mockResolvedValue(true);
    fromSelectMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    setupClassicClaim();
  });

  it('keeps a discoverable failed trip and surfaces its tripId when async enqueue fails', async () => {
    enqueueAsyncTripGenerationJobMock.mockResolvedValue(false);

    await expect(processQueuedTripGenerationAfterAuth('request-1')).rejects.toMatchObject({
      name: 'QueuedTripGenerationError',
      tripId: 'trip-queued-1',
    } satisfies Partial<QueuedTripGenerationError>);

    const persistedTrips = dbUpsertTripMock.mock.calls.map((call) => call[0] as ITrip);
    const failedPersistedTrip = persistedTrips[persistedTrips.length - 1];

    expect(failedPersistedTrip.id).toBe('trip-queued-1');
    expect(failedPersistedTrip.title).toBe('Barcelona');
    expect(failedPersistedTrip.aiMeta?.generation?.state).toBe('failed');
    expect(failedPersistedTrip.aiMeta?.generation?.latestAttempt?.errorMessage).toContain('Could not enqueue async generation job');
    expect(failedPersistedTrip.items.some((item) => item.loading)).toBe(false);
  });

  it('enqueues classic queue-claim work into async worker', async () => {
    const result = await processQueuedTripGenerationAfterAuth('request-1');

    expect(result.tripId).toBe('trip-queued-1');
    expect(result.trip.aiMeta?.generation?.state).toBe('queued');
    expect(enqueueAsyncTripGenerationJobMock).toHaveBeenCalledTimes(1);
    expect(enqueueAsyncTripGenerationJobMock).toHaveBeenCalledWith(expect.objectContaining({
      flow: 'classic',
      prompt: 'classic prompt',
    }));
    expect(startAttemptLogMock).toHaveBeenCalledWith(expect.objectContaining({
      state: 'queued',
      source: 'queue_claim_async',
    }));
  });

  it('enqueues wizard queue-claim work into async worker', async () => {
    claimRpcMock.mockImplementation((fn: string) => {
      if (fn === 'claim_trip_generation_request') {
        return Promise.resolve({
          data: {
            request_id: 'request-1',
            flow: 'wizard',
            payload: {
              version: 1,
              flow: 'wizard',
              destinationLabel: 'Portugal',
              startDate: '2026-04-10',
              endDate: '2026-04-14',
              options: {
                countries: ['Portugal'],
                budget: 'High',
                pace: 'Balanced',
                travelerType: 'family',
                travelerDetails: {
                  familyAdults: 2,
                  familyChildren: 2,
                  familyBabies: 0,
                },
                transportPreferences: ['train'],
                hasTransportOverride: true,
              },
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

    const result = await processQueuedTripGenerationAfterAuth('request-1');

    expect(result.tripId).toBe('trip-queued-1');
    expect(result.trip.aiMeta?.generation?.state).toBe('queued');
    expect(buildWizardItineraryPromptMock).toHaveBeenCalledTimes(1);
    expect(buildWizardItineraryPromptMock).toHaveBeenCalledWith(expect.objectContaining({
      countries: ['Portugal'],
      budget: 'High',
      pace: 'Balanced',
      travelerType: 'family',
      transportPreferences: ['train'],
      hasTransportOverride: true,
    }));
    expect(enqueueAsyncTripGenerationJobMock).toHaveBeenCalledWith(expect.objectContaining({
      flow: 'wizard',
      prompt: 'wizard prompt',
    }));
  });

  it('rejects already-processed queue claims without creating duplicate trips', async () => {
    claimRpcMock.mockImplementation((fn: string) => {
      if (fn === 'claim_trip_generation_request') {
        return Promise.resolve({
          data: {
            request_id: 'request-1',
            flow: 'classic',
            payload: {
              version: 1,
              flow: 'classic',
              destinationLabel: 'Berlin',
              destinationPrompt: 'Berlin',
              startDate: '2026-04-10',
              endDate: '2026-04-14',
              options: {},
            },
            status: 'completed',
            owner_user_id: 'owner-1',
            expires_at: new Date(Date.now() + 60_000).toISOString(),
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    await expect(processQueuedTripGenerationAfterAuth('request-1')).rejects.toThrow(
      'Queued request is already claimed or processed.',
    );

    expect(enqueueAsyncTripGenerationJobMock).not.toHaveBeenCalled();
  });

  it('reuses the already-claimed trip instead of throwing when a prior auth flow already consumed the request', async () => {
    claimRpcMock.mockImplementation((fn: string) => {
      if (fn === 'claim_trip_generation_request') {
        return Promise.resolve({
          data: null,
          error: {
            code: 'P0001',
            message: 'Queued request already claimed.',
          },
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
    fromSelectMaybeSingleMock.mockResolvedValue({
      data: {
        id: 'request-1',
        flow: 'classic',
        payload: {
          version: 1,
          flow: 'classic',
          destinationLabel: 'Mallorca',
          destinationPrompt: 'Mallorca',
          startDate: '2026-04-01',
          endDate: '2026-04-10',
          options: {},
        },
        status: 'queued',
        owner_user_id: 'owner-1',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        result_trip_id: 'trip-existing-42',
      },
      error: null,
    });

    const result = await processQueuedTripGenerationAfterAuth('request-1');

    expect(result.tripId).toBe('trip-existing-42');
    expect(result.trip.id).toBe('trip-existing-42');
    expect(result.trip.title).toBe('Mallorca');
    expect(enqueueAsyncTripGenerationJobMock).not.toHaveBeenCalled();
    expect(startAttemptLogMock).not.toHaveBeenCalled();
  });
});
