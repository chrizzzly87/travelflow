import { beforeEach, describe, expect, it, vi } from 'vitest';

const enqueueAsyncTripGenerationJobMock = vi.fn();
const startTripGenerationAttemptLogMock = vi.fn();
const finishTripGenerationAttemptLogMock = vi.fn();

vi.mock('../../utils', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../utils')>();
    return {
        ...original,
        generateTripId: vi.fn(() => 'trip-async-1'),
    };
});

vi.mock('../../services/tripGenerationAsyncEnqueueService', () => ({
    enqueueAsyncTripGenerationJob: (...args: unknown[]) => enqueueAsyncTripGenerationJobMock(...args),
}));

vi.mock('../../services/tripGenerationAttemptLogService', () => ({
    startTripGenerationAttemptLog: (...args: unknown[]) => startTripGenerationAttemptLogMock(...args),
    finishTripGenerationAttemptLog: (...args: unknown[]) => finishTripGenerationAttemptLogMock(...args),
}));

import { startClientAsyncTripGeneration } from '../../services/tripGenerationClientAsyncService';
import type { ITrip } from '../../types';

const buildTrip = (id: string): ITrip => ({
    id,
    title: 'Berlin',
    startDate: '2026-05-01',
    items: [
        {
            id: 'city-1',
            type: 'city',
            title: 'Berlin',
            startDateOffset: 0,
            duration: 3,
            location: 'Berlin',
            loading: true,
        },
    ],
    createdAt: 1,
    updatedAt: 1,
    isFavorite: false,
    status: 'active',
    sourceKind: 'created',
});

describe('startClientAsyncTripGeneration', () => {
    beforeEach(() => {
        enqueueAsyncTripGenerationJobMock.mockReset();
        startTripGenerationAttemptLogMock.mockReset();
        finishTripGenerationAttemptLogMock.mockReset();

        enqueueAsyncTripGenerationJobMock.mockResolvedValue(true);
        startTripGenerationAttemptLogMock.mockResolvedValue({ id: 'attempt-log-1' });
        finishTripGenerationAttemptLogMock.mockResolvedValue(undefined);
    });

    it('creates a queued trip, canonicalizes attempt id, and enqueues job payload', async () => {
        const updates: ITrip[] = [];
        const result = await startClientAsyncTripGeneration({
            flow: 'wizard',
            source: 'create_trip_v3',
            jobSource: 'create_trip_v3_async',
            destinationLabel: 'Berlin',
            startDate: '2026-05-01',
            roundTrip: true,
            prompt: 'wizard prompt body',
            provider: 'gemini',
            model: 'gemini-3-pro-preview',
            inputSnapshot: {
                flow: 'wizard',
                destinationLabel: 'Berlin',
                startDate: '2026-05-01',
                endDate: '2026-05-06',
                payload: {
                    options: {
                        countries: ['Germany'],
                    },
                },
            },
            buildOptimisticTrip: (tripId) => buildTrip(tripId),
            onTripUpdate: (trip) => {
                updates.push(trip);
            },
        });

        expect(result.tripId).toBe('trip-async-1');
        expect(result.attemptId).toBe('attempt-log-1');
        expect(result.trip.aiMeta?.generation?.state).toBe('queued');
        expect(result.trip.aiMeta?.generation?.latestAttempt?.id).toBe('attempt-log-1');
        expect(updates.length).toBe(2);
        expect(updates[0]?.aiMeta?.generation?.state).toBe('queued');
        expect(updates[1]?.aiMeta?.generation?.latestAttempt?.id).toBe('attempt-log-1');
        expect(enqueueAsyncTripGenerationJobMock).toHaveBeenCalledWith(expect.objectContaining({
            flow: 'wizard',
            tripId: 'trip-async-1',
            attemptId: 'attempt-log-1',
            source: 'create_trip_v3_async',
            prompt: 'wizard prompt body',
        }));
        expect(finishTripGenerationAttemptLogMock).not.toHaveBeenCalled();
    });

    it('marks trip failed and writes failed attempt log when enqueue fails', async () => {
        enqueueAsyncTripGenerationJobMock.mockResolvedValue(false);

        const updates: ITrip[] = [];

        await expect(() => startClientAsyncTripGeneration({
            flow: 'classic',
            source: 'create_trip_v2',
            jobSource: 'create_trip_v2_async',
            destinationLabel: 'Japan',
            startDate: '2026-06-01',
            roundTrip: false,
            prompt: 'classic prompt body',
            provider: 'gemini',
            model: 'gemini-3-pro-preview',
            inputSnapshot: {
                flow: 'classic',
                destinationLabel: 'Japan',
                startDate: '2026-06-01',
                endDate: '2026-06-08',
                payload: {
                    destinationPrompt: 'Japan',
                    options: {},
                },
            },
            buildOptimisticTrip: (tripId) => buildTrip(tripId),
            onTripUpdate: (trip) => {
                updates.push(trip);
            },
        })).rejects.toThrow('Could not enqueue async generation.');

        expect(updates.map((trip) => trip.aiMeta?.generation?.state)).toEqual(['queued', 'queued', 'failed']);
        expect(finishTripGenerationAttemptLogMock).toHaveBeenCalledWith(expect.objectContaining({
            attemptId: 'attempt-log-1',
            state: 'failed',
        }));
    });
});
