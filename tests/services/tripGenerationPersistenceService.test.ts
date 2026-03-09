import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureDbSessionMock = vi.fn();
const dbGetTripMock = vi.fn();

vi.mock('../../config/db', () => ({
    DB_ENABLED: true,
}));

vi.mock('../../services/dbApi', () => ({
    ensureDbSession: (...args: unknown[]) => ensureDbSessionMock(...args),
    dbGetTrip: (...args: unknown[]) => dbGetTripMock(...args),
}));

import { waitForTripPersistence } from '../../services/tripGenerationPersistenceService';

describe('waitForTripPersistence', () => {
    beforeEach(() => {
        ensureDbSessionMock.mockReset();
        dbGetTripMock.mockReset();
        ensureDbSessionMock.mockResolvedValue('user-1');
    });

    it('returns true when trip becomes readable within retry window', async () => {
        dbGetTripMock
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ trip: { id: 'trip-1' } });

        const result = await waitForTripPersistence('trip-1', {
            maxAttempts: 3,
            intervalMs: 0,
        });

        expect(result).toBe(true);
        expect(ensureDbSessionMock).toHaveBeenCalledTimes(1);
        expect(dbGetTripMock).toHaveBeenCalledTimes(2);
    });

    it('returns false when trip is still unavailable after max attempts', async () => {
        dbGetTripMock.mockResolvedValue(null);

        const result = await waitForTripPersistence('trip-2', {
            maxAttempts: 2,
            intervalMs: 0,
        });

        expect(result).toBe(false);
        expect(dbGetTripMock).toHaveBeenCalledTimes(2);
    });
});
