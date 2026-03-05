import { beforeEach, describe, expect, it, vi } from 'vitest';

const enqueueTripGenerationJobMock = vi.fn();

vi.mock('../../services/tripGenerationJobService', () => ({
    enqueueTripGenerationJob: (...args: unknown[]) => enqueueTripGenerationJobMock(...args),
}));

import { enqueueClassicAsyncTripGenerationJob } from '../../services/tripGenerationAsyncEnqueueService';

describe('tripGenerationAsyncEnqueueService.enqueueClassicAsyncTripGenerationJob', () => {
    beforeEach(() => {
        enqueueTripGenerationJobMock.mockReset();
    });

    it('returns true when the job enqueue succeeds and forwards normalized payload', async () => {
        enqueueTripGenerationJobMock.mockResolvedValue({ id: 'job-1' });

        const success = await enqueueClassicAsyncTripGenerationJob({
            tripId: 'trip-1',
            attemptId: 'attempt-1',
            requestId: 'request-1',
            source: 'create_trip_classic_lab_async',
            queueRequestId: 'queue-request-1',
            startDate: '2026-04-10',
            roundTrip: true,
            prompt: 'Plan a detailed travel itinerary',
            provider: 'gemini',
            model: 'gemini-3-pro-preview',
            inputSnapshot: {
                flow: 'classic',
                destinationLabel: 'Berlin',
                startDate: '2026-04-10',
                endDate: '2026-04-15',
                payload: {
                    destinationPrompt: 'Berlin',
                    options: {},
                },
            },
        });

        expect(success).toBe(true);
        expect(enqueueTripGenerationJobMock).toHaveBeenCalledWith(expect.objectContaining({
            tripId: 'trip-1',
            attemptId: 'attempt-1',
            maxRetries: 0,
            payload: expect.objectContaining({
                flow: 'classic',
                source: 'create_trip_classic_lab_async',
                requestId: 'request-1',
                queueRequestId: 'queue-request-1',
                startDate: '2026-04-10',
                roundTrip: true,
                prompt: 'Plan a detailed travel itinerary',
                target: {
                    provider: 'gemini',
                    model: 'gemini-3-pro-preview',
                },
            }),
        }));
    });

    it('returns false when job enqueue fails', async () => {
        enqueueTripGenerationJobMock.mockResolvedValue(null);

        const success = await enqueueClassicAsyncTripGenerationJob({
            tripId: 'trip-1',
            attemptId: 'attempt-1',
            requestId: 'request-1',
            source: 'create_trip_classic_lab_async',
            queueRequestId: null,
            startDate: '2026-04-10',
            roundTrip: false,
            prompt: 'Prompt',
            provider: 'gemini',
            model: 'gemini-3-pro-preview',
            inputSnapshot: {
                flow: 'classic',
                destinationLabel: 'Berlin',
                startDate: '2026-04-10',
                endDate: '2026-04-15',
                payload: {
                    destinationPrompt: 'Berlin',
                    options: {},
                },
            },
        });

        expect(success).toBe(false);
    });
});

