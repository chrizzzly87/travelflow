import { describe, expect, it } from 'vitest';

import type { ITrip } from '../../types';
import {
  createTripGenerationInputSnapshot,
  markTripGenerationFailed,
  markTripGenerationRunning,
} from '../../services/tripGenerationDiagnosticsService';

const buildTrip = (): ITrip => ({
  id: 'trip-1',
  title: 'Rome city break',
  startDate: '2026-03-01',
  items: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  status: 'active',
  tripExpiresAt: null,
  sourceKind: 'created',
});

describe('tripGenerationDiagnosticsService', () => {
  it('preserves trip identity/title and writes failed diagnostics on classic failure', () => {
    const snapshot = createTripGenerationInputSnapshot({
      flow: 'classic',
      destinationLabel: 'Rome',
      startDate: '2026-03-01',
      endDate: '2026-03-05',
      payload: {
        destinationPrompt: 'Rome',
        options: {
          totalDays: 4,
        },
      },
    });

    const runningTrip = markTripGenerationRunning(buildTrip(), {
      flow: 'classic',
      source: 'unit_test',
      inputSnapshot: snapshot,
      provider: 'gemini',
      model: 'gemini-3-pro-preview',
      requestId: 'request-1',
      attemptId: 'attempt-1',
    });

    const failedTrip = markTripGenerationFailed(runningTrip, {
      flow: 'classic',
      source: 'unit_test',
      requestId: 'request-1',
      attemptId: 'attempt-1',
      error: {
        code: 'AI_TIMEOUT',
        status: 504,
        message: 'Generation timed out while waiting for provider response.',
      },
    });

    expect(failedTrip.id).toBe('trip-1');
    expect(failedTrip.title).toBe('Rome city break');
    expect(failedTrip.aiMeta?.generation?.state).toBe('failed');
    expect(failedTrip.aiMeta?.generation?.inputSnapshot?.flow).toBe('classic');

    const attempt = failedTrip.aiMeta?.generation?.latestAttempt;
    expect(attempt?.requestId).toBe('request-1');
    expect(attempt?.failureKind).toBe('timeout');
    expect(attempt?.errorCode).toBe('AI_TIMEOUT');
    expect(attempt?.errorMessage).toContain('timed out');
    expect(attempt?.state).toBe('failed');
  });
});
