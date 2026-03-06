import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ITrip } from '../../types';

const buildClassicItineraryPromptMock = vi.fn().mockReturnValue('classic prompt');
const buildWizardItineraryPromptMock = vi.fn().mockReturnValue('wizard prompt');
const buildSurpriseItineraryPromptMock = vi.fn().mockReturnValue('surprise prompt');
const startAttemptLogMock = vi.fn();
const finishAttemptLogMock = vi.fn();
const enqueueAsyncTripGenerationJobMock = vi.fn();
const dbGetTripMock = vi.fn();
const triggerTripGenerationWorkerMock = vi.fn();

vi.mock('../../config/aiModelCatalog', () => ({
  getDefaultCreateTripModel: () => ({ id: 'default', provider: 'openai', model: 'gpt-4.1', availability: 'active' }),
  getAiModelById: () => null,
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

vi.mock('../../services/dbApi', () => ({
  dbGetTrip: (...args: unknown[]) => dbGetTripMock(...args),
}));

vi.mock('../../services/tripGenerationJobService', () => ({
  triggerTripGenerationWorker: (...args: unknown[]) => triggerTripGenerationWorkerMock(...args),
}));

import { retryTripGenerationWithDefaultModel } from '../../services/tripGenerationRetryService';

const buildTrip = (): ITrip => ({
  id: 'trip-existing',
  title: 'Tokyo trip',
  startDate: '2026-04-01',
  items: [],
  createdAt: 1,
  updatedAt: 1,
  status: 'active',
  sourceKind: 'created',
  aiMeta: {
    provider: 'gemini',
    model: 'gemini-3-pro-preview',
    generatedAt: '2026-03-01T00:00:00.000Z',
    generation: {
      state: 'failed',
      inputSnapshot: {
        flow: 'classic',
        destinationLabel: 'Tokyo',
        startDate: '2026-04-01',
        endDate: '2026-04-05',
        payload: {
          destinationPrompt: 'Tokyo',
          options: {
            totalDays: 4,
            aiTarget: {
              provider: 'gemini',
              model: 'gemini-3-pro-preview',
            },
          },
        },
        createdAt: '2026-03-01T00:00:00.000Z',
      },
      attempts: [
        {
          id: 'attempt-old',
          flow: 'classic',
          source: 'unit_test',
          state: 'failed',
          startedAt: '2026-03-01T00:00:00.000Z',
          finishedAt: '2026-03-01T00:00:02.000Z',
          durationMs: 2000,
          failureKind: 'provider',
          errorMessage: 'Bad model',
        },
      ],
      latestAttempt: {
        id: 'attempt-old',
        flow: 'classic',
        source: 'unit_test',
        state: 'failed',
        startedAt: '2026-03-01T00:00:00.000Z',
        finishedAt: '2026-03-01T00:00:02.000Z',
        durationMs: 2000,
        failureKind: 'provider',
        errorMessage: 'Bad model',
      },
      retryCount: 0,
      retryRequestedAt: null,
      lastSucceededAt: null,
      lastFailedAt: '2026-03-01T00:00:02.000Z',
    },
  },
});

describe('retryTripGenerationWithDefaultModel', () => {
  beforeEach(() => {
    startAttemptLogMock.mockReset();
    finishAttemptLogMock.mockReset();
    enqueueAsyncTripGenerationJobMock.mockReset();
    buildClassicItineraryPromptMock.mockClear();
    dbGetTripMock.mockReset();
    triggerTripGenerationWorkerMock.mockReset();

    startAttemptLogMock.mockResolvedValue({ id: 'attempt-log-1' });
    finishAttemptLogMock.mockResolvedValue(undefined);
    enqueueAsyncTripGenerationJobMock.mockResolvedValue(true);
    dbGetTripMock.mockResolvedValue(null);
    triggerTripGenerationWorkerMock.mockResolvedValue(true);
  });

  it('retries on same trip id and forces default model target via async enqueue', async () => {
    const updates: ITrip[] = [];
    const result = await retryTripGenerationWithDefaultModel(buildTrip(), {
      source: 'trip_info_modal',
      onTripUpdate: (trip) => {
        updates.push(trip);
      },
    });

    expect(result.state).toBe('queued');
    expect(result.trip.id).toBe('trip-existing');
    expect(result.trip.aiMeta?.generation?.state).toBe('queued');
    expect(result.trip.aiMeta?.generation?.latestAttempt?.id).toBe('attempt-log-1');
    expect(updates.every((trip) => trip.aiMeta?.generation?.state === 'queued')).toBe(true);

    expect(buildClassicItineraryPromptMock).toHaveBeenCalledTimes(1);
    expect(enqueueAsyncTripGenerationJobMock).toHaveBeenCalledWith(expect.objectContaining({
      flow: 'classic',
      tripId: 'trip-existing',
      prompt: 'classic prompt',
      provider: 'openai',
      model: 'gpt-4.1',
    }));
    expect(finishAttemptLogMock).not.toHaveBeenCalled();
  });

  it('keeps same trip id and records failed retry when enqueue fails', async () => {
    enqueueAsyncTripGenerationJobMock.mockResolvedValue(false);

    const result = await retryTripGenerationWithDefaultModel(buildTrip(), {
      source: 'trip_status_strip',
    });

    expect(result.state).toBe('failed');
    expect(result.trip.id).toBe('trip-existing');
    expect(result.trip.aiMeta?.generation?.state).toBe('failed');
    expect(result.trip.aiMeta?.generation?.latestAttempt?.errorMessage).toContain('Could not enqueue async generation retry');
    expect(finishAttemptLogMock).toHaveBeenCalledTimes(1);
  });

  it('does not enqueue when retry attempt log could not be initialized', async () => {
    startAttemptLogMock.mockResolvedValue(null);

    const result = await retryTripGenerationWithDefaultModel(buildTrip(), {
      source: 'trip_status_strip',
    });

    expect(result.state).toBe('failed');
    expect(result.trip.id).toBe('trip-existing');
    expect(result.trip.aiMeta?.generation?.state).toBe('failed');
    expect(result.trip.aiMeta?.generation?.latestAttempt?.errorMessage).toContain('Retry attempt could not be initialized');
    expect(enqueueAsyncTripGenerationJobMock).not.toHaveBeenCalled();
    expect(finishAttemptLogMock).not.toHaveBeenCalled();
  });

  it('returns existing queued trip from server and nudges worker instead of creating duplicate retry', async () => {
    const remoteQueuedTrip: ITrip = {
      ...buildTrip(),
      updatedAt: 123_456_789,
      aiMeta: {
        provider: 'openai',
        model: 'gpt-4.1',
        generation: {
          state: 'queued',
          inputSnapshot: buildTrip().aiMeta!.generation!.inputSnapshot,
          attempts: [
            {
              id: 'attempt-remote-queued',
              flow: 'classic',
              source: 'trip_status_strip',
              state: 'queued',
              startedAt: '2026-03-06T12:00:00.000Z',
              requestId: 'request-remote-queued',
              provider: 'openai',
              model: 'gpt-4.1',
              metadata: {
                orchestration: 'async_worker',
              },
            },
          ],
          latestAttempt: {
            id: 'attempt-remote-queued',
            flow: 'classic',
            source: 'trip_status_strip',
            state: 'queued',
            startedAt: '2026-03-06T12:00:00.000Z',
            requestId: 'request-remote-queued',
            provider: 'openai',
            model: 'gpt-4.1',
            metadata: {
              orchestration: 'async_worker',
            },
          },
          retryCount: 2,
          retryRequestedAt: '2026-03-06T12:00:00.000Z',
          lastSucceededAt: null,
          lastFailedAt: '2026-03-06T11:55:00.000Z',
        },
      },
    };
    dbGetTripMock.mockResolvedValue({ trip: remoteQueuedTrip });

    const onTripUpdate = vi.fn();
    const result = await retryTripGenerationWithDefaultModel(buildTrip(), {
      source: 'trip_status_strip',
      onTripUpdate,
    });

    expect(result.state).toBe('queued');
    expect(result.trip).toEqual(remoteQueuedTrip);
    expect(onTripUpdate).toHaveBeenCalledWith(remoteQueuedTrip);
    expect(triggerTripGenerationWorkerMock).toHaveBeenCalledWith(expect.objectContaining({
      tripId: remoteQueuedTrip.id,
      force: true,
    }));
    expect(startAttemptLogMock).not.toHaveBeenCalled();
    expect(enqueueAsyncTripGenerationJobMock).not.toHaveBeenCalled();
  });
});
