import { DB_ENABLED } from '../config/db';
import { dbGetTrip, ensureDbSession } from './dbApi';

interface WaitForTripPersistenceOptions {
    timeoutMs?: number;
    intervalMs?: number;
    maxAttempts?: number;
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => {
    setTimeout(resolve, ms);
});

export const waitForTripPersistence = async (
    tripId: string,
    options?: WaitForTripPersistenceOptions,
): Promise<boolean> => {
    const normalizedTripId = tripId.trim();
    if (!normalizedTripId) return false;
    if (!DB_ENABLED) return true;

    await ensureDbSession();

    const timeoutMs = Math.max(500, Math.round(options?.timeoutMs ?? 4_000));
    const intervalMs = Math.max(0, Math.round(options?.intervalMs ?? 200));
    const computedAttempts = Math.max(1, Math.ceil(timeoutMs / Math.max(intervalMs, 1)));
    const maxAttempts = Math.max(1, Math.round(options?.maxAttempts ?? computedAttempts));

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const result = await dbGetTrip(normalizedTripId);
        if (result?.trip?.id === normalizedTripId) return true;
        if (attempt < maxAttempts - 1 && intervalMs > 0) {
            await delay(intervalMs);
        }
    }

    return false;
};
