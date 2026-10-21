// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    mergeRecommendationState,
    readStoredRecommendationState,
    writeStoredRecommendationState,
} from '../../services/recommendationReactionsStore';
import type { SavedRecommendation } from '../../shared/recommendations';

const makeSaved = (id: string): SavedRecommendation => ({
    recommendationId: id,
    savedAt: '2026-09-01T00:00:00.000Z',
    title: `Place ${id}`,
    summary: '',
    description: null,
    activityTypes: [],
    tags: [],
    cityName: 'Taipei',
    location: { lat: 25, lng: 121, address: null },
    costBand: null,
    typicalDurationMinutes: null,
    sources: [],
});

describe('services/recommendationReactionsStore', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('remembers a trip’s decisions across a reload', () => {
        writeStoredRecommendationState('trip-1', { saved: [makeSaved('a')], dismissedIds: ['b'] });

        const restored = readStoredRecommendationState('trip-1');
        expect(restored.saved.map((entry) => entry.recommendationId)).toEqual(['a']);
        expect(restored.dismissedIds).toEqual(['b']);
    });

    it('keeps trips apart', () => {
        writeStoredRecommendationState('trip-1', { saved: [makeSaved('a')], dismissedIds: [] });
        expect(readStoredRecommendationState('trip-2')).toEqual({ saved: [], dismissedIds: [] });
    });

    it('reads as empty rather than throwing when storage holds junk', () => {
        window.localStorage.setItem('tf_trip_recommendations_v1', 'not json');
        expect(readStoredRecommendationState('trip-1')).toEqual({ saved: [], dismissedIds: [] });
    });

    it('survives storage being unavailable', () => {
        const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });

        expect(() => writeStoredRecommendationState('trip-1', { saved: [], dismissedIds: ['x'] })).not.toThrow();
        setItem.mockRestore();
    });

    it('caps how many trips one browser accumulates', () => {
        for (let index = 0; index < 45; index += 1) {
            writeStoredRecommendationState(`trip-${index}`, { saved: [], dismissedIds: [String(index)] });
        }

        const raw = JSON.parse(window.localStorage.getItem('tf_trip_recommendations_v1') || '{}');
        expect(Object.keys(raw.trips).length).toBeLessThanOrEqual(40);
        // The most recent write is the one that must still be there.
        expect(readStoredRecommendationState('trip-44').dismissedIds).toEqual(['44']);
    });

    describe('mergeRecommendationState', () => {
        it('takes the union, so neither home can un-make a decision', () => {
            const merged = mergeRecommendationState(
                { saved: [makeSaved('a')], dismissedIds: ['x'] },
                { saved: [makeSaved('b')], dismissedIds: ['y'] },
            );

            expect(merged.saved.map((entry) => entry.recommendationId).sort()).toEqual(['a', 'b']);
            expect(merged.dismissedIds.sort()).toEqual(['x', 'y']);
        });

        it('lets a keep win over a skip of the same idea', () => {
            const merged = mergeRecommendationState(
                { saved: [makeSaved('a')], dismissedIds: [] },
                { saved: [], dismissedIds: ['a'] },
            );

            expect(merged.saved.map((entry) => entry.recommendationId)).toEqual(['a']);
            expect(merged.dismissedIds).toEqual([]);
        });

        it('works when the trip carries nothing at all', () => {
            const merged = mergeRecommendationState(undefined, { saved: [makeSaved('a')], dismissedIds: ['z'] });
            expect(merged.saved).toHaveLength(1);
            expect(merged.dismissedIds).toEqual(['z']);
        });
    });
});
