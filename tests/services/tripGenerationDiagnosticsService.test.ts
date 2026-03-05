import { describe, expect, it } from 'vitest';

import type { ITrip } from '../../types';
import {
  TRIP_GENERATION_STALE_GRACE_MS,
  TRIP_GENERATION_TIMEOUT_MS,
  createTripGenerationInputSnapshot,
  getTripGenerationElapsedMs,
  getTripGenerationState,
  markTripGenerationFailed,
  markTripGenerationRunning,
  normalizeTripGenerationAttemptsForDisplay,
  withLatestTripGenerationAttemptId,
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

  it('clears loading placeholders when generation fails', () => {
    const baseTrip = buildTrip();
    baseTrip.items = [
      {
        id: 'loading-city-1',
        type: 'city',
        title: 'Planning Rome',
        startDateOffset: 0,
        duration: 1,
        color: 'bg-slate-100',
        loading: true,
      },
    ];

    const runningTrip = markTripGenerationRunning(baseTrip, {
      flow: 'classic',
      source: 'unit_test',
      inputSnapshot: createTripGenerationInputSnapshot({
        flow: 'classic',
        destinationLabel: 'Rome',
        startDate: '2026-03-01',
        endDate: '2026-03-05',
        payload: { destinationPrompt: 'Rome', options: {} },
      }),
      provider: 'gemini',
      model: 'gemini-3-pro-preview',
      requestId: 'request-clear-loading',
      attemptId: 'attempt-clear-loading',
    });

    const failedTrip = markTripGenerationFailed(runningTrip, {
      flow: 'classic',
      source: 'unit_test',
      requestId: 'request-clear-loading',
      attemptId: 'attempt-clear-loading',
      error: new Error('Provider error'),
    });

    expect(failedTrip.aiMeta?.generation?.state).toBe('failed');
    expect(failedTrip.items.some((item) => item.loading)).toBe(false);
  });

  it('treats running generation as failed when stale timeout window is exceeded', () => {
    const nowMs = Date.parse('2026-03-04T10:00:00.000Z');
    const startedAt = new Date(
      nowMs - TRIP_GENERATION_TIMEOUT_MS - TRIP_GENERATION_STALE_GRACE_MS - 1200
    ).toISOString();

    const runningTrip = markTripGenerationRunning(buildTrip(), {
      flow: 'classic',
      source: 'unit_test',
      inputSnapshot: createTripGenerationInputSnapshot({
        flow: 'classic',
        destinationLabel: 'Berlin',
        startDate: '2026-03-10',
        endDate: '2026-03-12',
        payload: { destinationPrompt: 'Berlin', options: {} },
      }),
      provider: 'openai',
      model: 'gpt-4.1',
      requestId: 'request-stale',
      attemptId: 'attempt-stale',
      startedAt,
    });

    const elapsedMs = getTripGenerationElapsedMs(runningTrip, nowMs);
    expect(elapsedMs).not.toBeNull();
    expect(elapsedMs || 0).toBeGreaterThan(TRIP_GENERATION_TIMEOUT_MS);
    expect(getTripGenerationState(runningTrip, nowMs)).toBe('failed');
  });

  it('treats legacy loading-error placeholders as failed without aiMeta state', () => {
    const legacyFailedTrip = buildTrip();
    legacyFailedTrip.title = 'Trip generation failed. Please try again.';
    legacyFailedTrip.items = [
      {
        id: 'loading-error-trip-1',
        type: 'city',
        title: 'Trip generation failed. Please try again.',
        startDateOffset: 0,
        duration: 3,
        color: 'bg-rose-100 border-rose-300 text-rose-700',
        description: 'Provider error',
        location: 'Albania',
      },
    ];

    expect(getTripGenerationState(legacyFailedTrip)).toBe('failed');
  });

  it('rewrites latest attempt id to canonical db id and keeps attempt history deduped', () => {
    const runningTrip = markTripGenerationRunning(buildTrip(), {
      flow: 'classic',
      source: 'unit_test',
      inputSnapshot: createTripGenerationInputSnapshot({
        flow: 'classic',
        destinationLabel: 'Berlin',
        startDate: '2026-03-10',
        endDate: '2026-03-12',
        payload: { destinationPrompt: 'Berlin', options: {} },
      }),
      provider: 'openai',
      model: 'gpt-4.1',
      requestId: 'request-canonical',
      attemptId: 'attempt-local-temp',
    });

    const canonicalTrip = withLatestTripGenerationAttemptId(runningTrip, 'attempt-db-1');

    expect(canonicalTrip.aiMeta?.generation?.latestAttempt?.id).toBe('attempt-db-1');
    expect(canonicalTrip.aiMeta?.generation?.attempts?.map((attempt) => attempt.id)).toEqual(['attempt-db-1']);
  });

  it('normalizes duplicate attempts by request and prefers terminal diagnostics', () => {
    const nowMs = Date.parse('2026-03-04T12:00:00.000Z');
    const normalized = normalizeTripGenerationAttemptsForDisplay([
      {
        id: 'attempt-local',
        flow: 'classic',
        source: 'trip_info',
        state: 'running',
        startedAt: '2026-03-04T11:59:10.000Z',
        requestId: 'req-42',
        provider: 'openai',
        model: 'gpt-4.1',
      },
      {
        id: 'attempt-db',
        flow: 'classic',
        source: 'trip_info',
        state: 'failed',
        startedAt: '2026-03-04T11:59:10.000Z',
        finishedAt: '2026-03-04T11:59:45.000Z',
        durationMs: 35_000,
        requestId: 'req-42',
        provider: 'openai',
        model: 'gpt-4.1',
        failureKind: 'timeout',
        errorCode: 'AI_TIMEOUT',
        errorMessage: 'Timed out',
      },
    ], {
      nowMs,
      limit: 12,
    });

    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.state).toBe('failed');
    expect(normalized[0]?.requestId).toBe('req-42');
    expect(normalized[0]?.errorCode).toBe('AI_TIMEOUT');
  });
});
