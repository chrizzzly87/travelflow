import { beforeEach, describe, expect, it, vi } from 'vitest';

const enqueueTripGenerationJobMock = vi.fn();

vi.mock('../../services/tripGenerationJobService', () => ({
    enqueueTripGenerationJob: (...args: unknown[]) => enqueueTripGenerationJobMock(...args),
}));

import {
    enqueueAsyncTripGenerationJob,
    enqueueClassicAsyncTripGenerationJob,
} from '../../services/tripGenerationAsyncEnqueueService';

describe('tripGenerationAsyncEnqueueService.enqueueClassicAsyncTripGenerationJob', () => {
    beforeEach(() => {
        enqueueTripGenerationJobMock.mockReset();
    });

    it('returns true when the job enqueue succeeds and forwards normalized payload', async () => {
        enqueueTripGenerationJobMock.mockResolvedValue({ id: 'job-1', state: 'queued' });

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

describe('tripGenerationAsyncEnqueueService.enqueueAsyncTripGenerationJob', () => {
    beforeEach(() => {
        enqueueTripGenerationJobMock.mockReset();
    });

    it('forwards non-classic flow payloads', async () => {
        enqueueTripGenerationJobMock.mockResolvedValue({ id: 'job-2', state: 'queued' });

        const success = await enqueueAsyncTripGenerationJob({
            flow: 'wizard',
            tripId: 'trip-2',
            attemptId: 'attempt-2',
            requestId: 'request-2',
            source: 'queue_claim_async',
            queueRequestId: 'queue-2',
            startDate: '2026-05-01',
            roundTrip: false,
            prompt: 'Wizard prompt body',
            provider: 'gemini',
            model: 'gemini-3-pro-preview',
            inputSnapshot: {
                flow: 'wizard',
                destinationLabel: 'Portugal',
                startDate: '2026-05-01',
                endDate: '2026-05-10',
                payload: {
                    options: {
                        countries: ['Portugal'],
                    },
                },
                createdAt: '2026-03-05T00:00:00.000Z',
            },
            maxRetries: 0,
        });

        expect(success).toBe(true);
        expect(enqueueTripGenerationJobMock).toHaveBeenCalledWith(expect.objectContaining({
            tripId: 'trip-2',
            attemptId: 'attempt-2',
            payload: expect.objectContaining({
                flow: 'wizard',
                requestId: 'request-2',
                prompt: 'Wizard prompt body',
            }),
        }));
    });

    it('returns false when enqueue returns a terminal state row', async () => {
        enqueueTripGenerationJobMock.mockResolvedValue({ id: 'job-3', state: 'failed' });

        const success = await enqueueAsyncTripGenerationJob({
            flow: 'classic',
            tripId: 'trip-3',
            attemptId: 'attempt-3',
            requestId: 'request-3',
            source: 'trip_status_strip',
            queueRequestId: null,
            startDate: '2026-05-01',
            roundTrip: true,
            prompt: 'Classic prompt',
            provider: 'openai',
            model: 'gpt-5.4',
            inputSnapshot: {
                flow: 'classic',
                destinationLabel: 'Paris',
                startDate: '2026-05-01',
                endDate: '2026-05-10',
                payload: {
                    destinationPrompt: 'Paris',
                    options: {},
                },
            },
        });

        expect(success).toBe(false);
    });
});
