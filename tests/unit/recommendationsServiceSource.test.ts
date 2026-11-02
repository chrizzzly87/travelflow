import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    __resetRecommendationDatasetCache,
    loadBundledRecommendationDataset,
    loadRecommendationDataset,
} from '../../services/recommendationsService';

const originalFetch = globalThis.fetch;

describe('services/recommendationsService — where the library comes from', () => {
    beforeEach(() => {
        __resetRecommendationDatasetCache();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        __resetRecommendationDatasetCache();
        vi.restoreAllMocks();
    });

    it('prefers what the database published', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                ok: true,
                recommendations: [{ id: 'rec_tw_db', title: 'From the database' }],
            }),
        });
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const dataset = await loadRecommendationDataset('tw');

        expect(fetchMock).toHaveBeenCalledWith('/api/recommendations?country=TW', expect.anything());
        expect(dataset?.sourceName).toBe('supabase');
        expect(dataset?.recommendations).toHaveLength(1);
    });

    it('falls back to the bundled dataset when the endpoint is unreachable', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

        const dataset = await loadRecommendationDataset('TW');

        // The bundled Taiwan copy, not an empty deck.
        expect(dataset?.countryCode).toBe('TW');
        expect((dataset?.recommendations.length ?? 0)).toBeGreaterThan(50);
        expect(dataset?.sourceName).not.toBe('supabase');
    });

    it('falls back when the endpoint answers with an error status', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch;

        const dataset = await loadRecommendationDataset('TW');
        expect((dataset?.recommendations.length ?? 0)).toBeGreaterThan(50);
    });

    it('treats an empty published list as an answer, not as a failure', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true, recommendations: [] }),
        }) as unknown as typeof fetch;

        const dataset = await loadRecommendationDataset('TW');

        // Falling back here would show ideas an editor deliberately unpublished.
        expect(dataset?.recommendations).toEqual([]);
        expect(dataset?.sourceName).toBe('supabase');
    });

    it('returns nothing for a country with neither rows nor a bundled copy', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch;

        expect(await loadRecommendationDataset('PT')).toBeNull();
    });

    it('reads the bundled file directly when seeding, whatever the API says', async () => {
        // Once the table exists and is empty, the ordinary loader correctly
        // answers "nothing published" — which would leave the admin's seed
        // with nothing to import.
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true, recommendations: [] }),
        });
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const bundled = await loadBundledRecommendationDataset('tw');

        expect(fetchMock).not.toHaveBeenCalled();
        expect((bundled?.recommendations.length ?? 0)).toBeGreaterThan(50);
    });

    it('asks once per country and reuses the answer', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true, recommendations: [] }),
        });
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        await Promise.all([loadRecommendationDataset('TW'), loadRecommendationDataset('tw')]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
