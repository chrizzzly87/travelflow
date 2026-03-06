import { describe, expect, it } from 'vitest';

import type { ITrip } from '../../types';
import {
    shouldApplyPolledTripUpdate,
    shouldPollTripGenerationState,
} from '../../services/tripGenerationPollingService';

const buildTrip = (patch?: Partial<ITrip>): ITrip => ({
    id: 'trip-1',
    title: 'Trip',
    startDate: '2026-04-10',
    items: [],
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    isFavorite: false,
    ...patch,
});

describe('tripGenerationPollingService.shouldApplyPolledTripUpdate', () => {
    it('applies updates when the remote trip has a newer updatedAt timestamp', () => {
        const localTrip = buildTrip({ updatedAt: 100 });
        const remoteTrip = buildTrip({ updatedAt: 200 });

        expect(shouldApplyPolledTripUpdate(localTrip, remoteTrip, Date.now())).toBe(true);
    });

    it('applies updates when generation state changes even if timestamps are equal', () => {
        const nowIso = new Date().toISOString();
        const localTrip = buildTrip({
            updatedAt: 100,
            aiMeta: {
                provider: 'gemini',
                model: 'gemini-3-pro-preview',
                generation: {
                    state: 'running',
                    latestAttempt: {
                        id: 'attempt-1',
                        flow: 'classic',
                        source: 'queue_claim',
                        state: 'running',
                        startedAt: nowIso,
                    },
                    attempts: [],
                    inputSnapshot: null,
                    retryCount: 0,
                    retryRequestedAt: null,
                    lastSucceededAt: null,
                    lastFailedAt: null,
                },
            },
        });
        const remoteTrip = buildTrip({
            updatedAt: 100,
            aiMeta: {
                provider: 'gemini',
                model: 'gemini-3-pro-preview',
                generation: {
                    state: 'failed',
                    latestAttempt: {
                        id: 'attempt-1',
                        flow: 'classic',
                        source: 'queue_claim',
                        state: 'failed',
                        startedAt: nowIso,
                        finishedAt: nowIso,
                    },
                    attempts: [],
                    inputSnapshot: null,
                    retryCount: 0,
                    retryRequestedAt: null,
                    lastSucceededAt: null,
                    lastFailedAt: nowIso,
                },
            },
        });

        expect(shouldApplyPolledTripUpdate(localTrip, remoteTrip, Date.now())).toBe(true);
    });

    it('skips updates when timestamps and generation state are unchanged', () => {
        const nowIso = new Date().toISOString();
        const localTrip = buildTrip({
            updatedAt: 100,
            aiMeta: {
                provider: 'gemini',
                model: 'gemini-3-pro-preview',
                generation: {
                    state: 'succeeded',
                    latestAttempt: {
                        id: 'attempt-1',
                        flow: 'classic',
                        source: 'queue_claim',
                        state: 'succeeded',
                        startedAt: nowIso,
                        finishedAt: nowIso,
                    },
                    attempts: [],
                    inputSnapshot: null,
                    retryCount: 0,
                    retryRequestedAt: null,
                    lastSucceededAt: nowIso,
                    lastFailedAt: null,
                },
            },
        });
        const remoteTrip = buildTrip({
            updatedAt: 100,
            aiMeta: localTrip.aiMeta,
        });

        expect(shouldApplyPolledTripUpdate(localTrip, remoteTrip, Date.now())).toBe(false);
    });
});

describe('tripGenerationPollingService.shouldPollTripGenerationState', () => {
    it('returns false when generation is stale-failed even if explicit state is still running', () => {
        const startedAt = new Date(Date.now() - 90_000).toISOString();
        const trip = buildTrip({
            aiMeta: {
                provider: 'gemini',
                model: 'gemini-3-pro-preview',
                generation: {
                    state: 'running',
                    latestAttempt: {
                        id: 'attempt-running-stale',
                        flow: 'classic',
                        source: 'queue_claim',
                        state: 'running',
                        startedAt,
                    },
                    attempts: [],
                    inputSnapshot: null,
                    retryCount: 0,
                    retryRequestedAt: null,
                    lastSucceededAt: null,
                    lastFailedAt: null,
                },
            },
        });

        expect(shouldPollTripGenerationState(trip, Date.now())).toBe(false);
    });

    it('returns true while generation is actively queued/running', () => {
        const startedAt = new Date(Date.now() - 5_000).toISOString();
        const runningTrip = buildTrip({
            aiMeta: {
                provider: 'gemini',
                model: 'gemini-3-pro-preview',
                generation: {
                    state: 'running',
                    latestAttempt: {
                        id: 'attempt-running-active',
                        flow: 'classic',
                        source: 'queue_claim',
                        state: 'running',
                        startedAt,
                    },
                    attempts: [],
                    inputSnapshot: null,
                    retryCount: 0,
                    retryRequestedAt: null,
                    lastSucceededAt: null,
                    lastFailedAt: null,
                },
            },
        });

        expect(shouldPollTripGenerationState(runningTrip, Date.now())).toBe(true);
    });
});
