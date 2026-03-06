// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { __shouldUploadLocalTripSnapshot } from '../../services/dbService';
import { makeTrip } from '../helpers/tripFixtures';

const withGenerationState = (state: 'queued' | 'running' | 'failed' | 'succeeded') => ({
    aiMeta: {
        generation: {
            state,
            latestAttempt: {
                state,
            },
        },
    },
});

describe('services/dbService __shouldUploadLocalTripSnapshot', () => {
    it('returns false when remote trip is newer', () => {
        const localTrip = makeTrip({
            id: 'trip-1',
            updatedAt: 1000,
            ...withGenerationState('queued'),
        });
        const remoteTrip = makeTrip({
            id: 'trip-1',
            updatedAt: 2000,
            ...withGenerationState('succeeded'),
        });

        expect(__shouldUploadLocalTripSnapshot({
            localTrip,
            remoteTrip,
            remoteUpdatedAtMs: 2000,
        })).toBe(false);
    });

    it('returns false when local trip is in-flight but remote generation is terminal', () => {
        const localTrip = makeTrip({
            id: 'trip-2',
            updatedAt: 3000,
            ...withGenerationState('queued'),
        });
        const remoteTrip = makeTrip({
            id: 'trip-2',
            updatedAt: 2500,
            ...withGenerationState('succeeded'),
        });

        expect(__shouldUploadLocalTripSnapshot({
            localTrip,
            remoteTrip,
            remoteUpdatedAtMs: 2500,
        })).toBe(false);
    });

    it('returns true when local trip is newer and remote generation is not terminal', () => {
        const localTrip = makeTrip({
            id: 'trip-3',
            updatedAt: 3200,
            ...withGenerationState('queued'),
        });
        const remoteTrip = makeTrip({
            id: 'trip-3',
            updatedAt: 2500,
            ...withGenerationState('queued'),
        });

        expect(__shouldUploadLocalTripSnapshot({
            localTrip,
            remoteTrip,
            remoteUpdatedAtMs: 2500,
        })).toBe(true);
    });

    it('returns true when local trip has no remote counterpart', () => {
        const localTrip = makeTrip({
            id: 'trip-4',
            updatedAt: 5000,
            ...withGenerationState('failed'),
        });

        expect(__shouldUploadLocalTripSnapshot({
            localTrip,
            remoteTrip: null,
            remoteUpdatedAtMs: null,
        })).toBe(true);
    });
});
