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

    it('does not regress a local queued retry to an older remote failed attempt', () => {
        const nowMs = Date.now();
        const olderIso = new Date(nowMs - 120_000).toISOString();
        const newerIso = new Date(nowMs - 10_000).toISOString();

        const localTrip = buildTrip({
            updatedAt: 500,
            aiMeta: {
                provider: 'openai',
                model: 'gpt-5.4',
                generation: {
                    state: 'queued',
                    latestAttempt: {
                        id: 'attempt-new',
                        flow: 'classic',
                        source: 'trip_status_strip',
                        state: 'queued',
                        startedAt: newerIso,
                    },
                    attempts: [],
                    inputSnapshot: null,
                    retryCount: 1,
                    retryRequestedAt: newerIso,
                    lastSucceededAt: null,
                    lastFailedAt: olderIso,
                },
            },
        });

        const remoteTrip = buildTrip({
            updatedAt: 400,
            aiMeta: {
                provider: 'openai',
                model: 'gpt-5.4',
                generation: {
                    state: 'failed',
                    latestAttempt: {
                        id: 'attempt-old',
                        flow: 'classic',
                        source: 'queue_claim_async_worker',
                        state: 'failed',
                        startedAt: olderIso,
                        finishedAt: olderIso,
                    },
                    attempts: [],
                    inputSnapshot: null,
                    retryCount: 0,
                    retryRequestedAt: null,
                    lastSucceededAt: null,
                    lastFailedAt: olderIso,
                },
            },
        });

        expect(shouldApplyPolledTripUpdate(localTrip, remoteTrip, nowMs)).toBe(false);
    });

    it('applies older remote terminal state when local in-flight attempt is stale', () => {
        const nowMs = Date.now();
        const remoteAttemptIso = new Date(nowMs - 120_000).toISOString();
        const staleLocalAttemptIso = new Date(nowMs - 100_000).toISOString();

        const localTrip = buildTrip({
            updatedAt: 500,
            aiMeta: {
                provider: 'openai',
                model: 'gpt-5.4',
                generation: {
                    state: 'queued',
                    latestAttempt: {
                        id: 'attempt-local-stale',
                        flow: 'classic',
                        source: 'trip_status_strip',
                        state: 'queued',
                        startedAt: staleLocalAttemptIso,
                        metadata: {
                            orchestration: 'async_worker',
                        },
                    },
                    attempts: [],
                    inputSnapshot: null,
                    retryCount: 2,
                    retryRequestedAt: staleLocalAttemptIso,
                    lastSucceededAt: null,
                    lastFailedAt: null,
                },
            },
        });

        const remoteTrip = buildTrip({
            updatedAt: 400,
            aiMeta: {
                provider: 'openai',
                model: 'gpt-5.4',
                generation: {
                    state: 'failed',
                    latestAttempt: {
                        id: 'attempt-remote-terminal',
                        flow: 'classic',
                        source: 'queue_claim_async_worker',
                        state: 'failed',
                        startedAt: remoteAttemptIso,
                        finishedAt: remoteAttemptIso,
                    },
                    attempts: [],
                    inputSnapshot: null,
                    retryCount: 1,
                    retryRequestedAt: null,
                    lastSucceededAt: null,
                    lastFailedAt: remoteAttemptIso,
                },
            },
        });

        expect(shouldApplyPolledTripUpdate(localTrip, remoteTrip, nowMs)).toBe(true);
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

    it('returns false when queued metadata is stale but trip content already reflects a newer successful generation', () => {
        const lastSucceededAt = '2026-03-04T10:00:00.000Z';
        const attemptStartedAt = '2026-03-04T09:58:00.000Z';
        const trip = buildTrip({
            items: [
                {
                    id: 'city-real-1',
                    type: 'city',
                    title: 'Berlin',
                    startDateOffset: 0,
                    duration: 2,
                    color: 'bg-sky-100 border-sky-300 text-sky-800',
                    description: 'Materialized itinerary content.',
                    location: 'Berlin',
                    coordinates: { lat: 52.52, lng: 13.405 },
                },
            ],
            aiMeta: {
                provider: 'openai',
                model: 'gpt-5.4',
                generatedAt: lastSucceededAt,
                generation: {
                    state: 'queued',
                    latestAttempt: {
                        id: 'attempt-stale-queued',
                        flow: 'classic',
                        source: 'trip_status_strip',
                        state: 'queued',
                        startedAt: attemptStartedAt,
                        provider: 'openai',
                        model: 'gpt-5.4',
                        metadata: {
                            orchestration: 'async_worker',
                        },
                    },
                    attempts: [],
                    inputSnapshot: null,
                    retryCount: 0,
                    retryRequestedAt: null,
                    lastSucceededAt,
                    lastFailedAt: null,
                },
            },
        });

        expect(shouldPollTripGenerationState(trip, Date.parse(lastSucceededAt))).toBe(false);
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
