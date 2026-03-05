import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ITrip } from '../../types';

const generateFromSnapshotMock = vi.fn();
const startAttemptLogMock = vi.fn();
const finishAttemptLogMock = vi.fn();
const beginAbortTelemetryMock = vi.fn(() => ({ cancel: vi.fn() }));

vi.mock('../../config/aiModelCatalog', () => ({
  getDefaultCreateTripModel: () => ({ provider: 'openai', model: 'gpt-4.1' }),
}));

vi.mock('../../services/aiService', () => ({
  generateTripFromInputSnapshot: (...args: unknown[]) => generateFromSnapshotMock(...args),
}));

vi.mock('../../services/tripGenerationAttemptLogService', () => ({
  startTripGenerationAttemptLog: (...args: unknown[]) => startAttemptLogMock(...args),
  finishTripGenerationAttemptLog: (...args: unknown[]) => finishAttemptLogMock(...args),
}));

vi.mock('../../services/tripGenerationAbortTelemetryService', () => ({
  beginTripGenerationAbortTelemetry: (...args: unknown[]) => beginAbortTelemetryMock(...args),
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
    generateFromSnapshotMock.mockReset();
    startAttemptLogMock.mockReset();
    finishAttemptLogMock.mockReset();
    beginAbortTelemetryMock.mockClear();

    startAttemptLogMock.mockResolvedValue({ id: 'attempt-log-1' });
    finishAttemptLogMock.mockResolvedValue(undefined);
  });

  it('retries on same trip id and forces default model target', async () => {
    generateFromSnapshotMock.mockResolvedValue({
      id: 'generated-trip-id-should-not-be-used',
      title: 'Tokyo highlights',
      startDate: '2026-04-01',
      items: [],
      createdAt: 2,
      updatedAt: 2,
      status: 'active',
      sourceKind: 'created',
      aiMeta: {
        provider: 'openai',
        model: 'gpt-4.1',
        generatedAt: '2026-03-02T00:00:00.000Z',
      },
    } satisfies ITrip);

    const updates: ITrip[] = [];
    const result = await retryTripGenerationWithDefaultModel(buildTrip(), {
      source: 'trip_info_modal',
      onTripUpdate: (trip) => {
        updates.push(trip);
      },
    });

    expect(result.state).toBe('succeeded');
    expect(result.trip.id).toBe('trip-existing');
    expect(result.trip.aiMeta?.generation?.state).toBe('succeeded');
    expect(updates.map((trip) => trip.aiMeta?.generation?.state)).toEqual(['running', 'running', 'succeeded']);
    expect(result.trip.aiMeta?.generation?.latestAttempt?.id).toBe('attempt-log-1');

    expect(generateFromSnapshotMock).toHaveBeenCalledTimes(1);
    expect(generateFromSnapshotMock.mock.calls[0]?.[1]).toMatchObject({
      aiTarget: {
        provider: 'openai',
        model: 'gpt-4.1',
      },
    });
  });

  it('keeps same trip id and records failed retry when generation errors', async () => {
    generateFromSnapshotMock.mockRejectedValue(new Error('Provider timeout'));

    const result = await retryTripGenerationWithDefaultModel(buildTrip(), {
      source: 'trip_status_strip',
    });

    expect(result.state).toBe('failed');
    expect(result.trip.id).toBe('trip-existing');
    expect(result.trip.aiMeta?.generation?.state).toBe('failed');
    expect(result.trip.aiMeta?.generation?.latestAttempt?.errorMessage).toContain('Provider timeout');
    expect(finishAttemptLogMock).toHaveBeenCalled();
  });
});
