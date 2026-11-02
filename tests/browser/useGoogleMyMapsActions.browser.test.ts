// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useGoogleMyMapsActions } from '../../components/tripview/useGoogleMyMapsActions';
import { writeStoredRecommendationState } from '../../services/recommendationReactionsStore';
import type { SavedRecommendation } from '../../shared/recommendations';
import type { ITrip, ITripRecommendationState } from '../../types';

const idea = (id: string): SavedRecommendation => ({
    recommendationId: id,
    savedAt: '2026-09-28T00:00:00.000Z',
    title: `Place ${id}`,
    summary: '',
    description: null,
    activityTypes: ['food'],
    tags: [],
    cityName: 'Taipei',
    location: { lat: 25, lng: 121.5, address: null },
    costBand: null,
    typicalDurationMinutes: null,
    sources: [],
    review: 'pending',
});

const trip = (recommendationState?: ITripRecommendationState): ITrip => ({
    id: 'trip-1',
    title: 'Taiwan',
    startDate: '2026-11-02',
    createdAt: 1,
    updatedAt: 1,
    items: [],
    recommendationState,
});

const renderActions = (current: ITrip) => {
    const commitRecommendationState = vi.fn();
    const { result } = renderHook(() => useGoogleMyMapsActions({
        trip: current,
        displayTrip: current,
        tripRef: { current },
        appLanguage: 'en',
        ideaState: current.recommendationState ?? { saved: [], dismissedIds: [] },
        commitRecommendationState,
    }));
    return { result, commitRecommendationState };
};

describe('useGoogleMyMapsActions', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('commits imported ideas to the trip, not only to this browser', () => {
        // Regression: the import used `persist` alone, which never reached the
        // database, so the next load dropped every imported idea from the map.
        const { result, commitRecommendationState } = renderActions(trip());
        const added = result.current.importIdeas([idea('gmm-a'), idea('gmm-b')]);

        expect(added).toBe(2);
        expect(commitRecommendationState).toHaveBeenCalledTimes(1);
        const [next, label] = commitRecommendationState.mock.calls[0];
        expect(next.saved.map((entry: SavedRecommendation) => entry.recommendationId)).toEqual(['gmm-a', 'gmm-b']);
        expect(label).toBe('Data: Imported Google My Maps pins');
    });

    it('writes back ideas only this device knows, even when nothing is new', () => {
        writeStoredRecommendationState('trip-1', { saved: [idea('gmm-a')], dismissedIds: [] });
        const { result, commitRecommendationState } = renderActions(trip({ saved: [], dismissedIds: [] }));

        expect(result.current.importIdeas([idea('gmm-a')])).toBe(0);
        expect(commitRecommendationState).toHaveBeenCalledTimes(1);
        expect(commitRecommendationState.mock.calls[0][0].saved).toHaveLength(1);
    });

    it('does nothing when the trip already has everything', () => {
        const { result, commitRecommendationState } = renderActions(trip({ saved: [idea('gmm-a')], dismissedIds: [] }));
        expect(result.current.importIdeas([idea('gmm-a')])).toBe(0);
        expect(commitRecommendationState).not.toHaveBeenCalled();
    });
});
