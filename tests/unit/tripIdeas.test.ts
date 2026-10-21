import { describe, expect, it } from 'vitest';

import {
    buildMapIdeaMarkers,
    buildMapIdeaSignature,
    isIdeaPending,
    listActiveIdeas,
    setIdeaReview,
} from '../../shared/tripIdeas';
import type { SavedRecommendation } from '../../shared/recommendations';

const idea = (id: string, overrides: Partial<SavedRecommendation> = {}): SavedRecommendation => ({
    recommendationId: id,
    savedAt: '2026-09-28T00:00:00.000Z',
    title: `Place ${id}`,
    summary: '',
    description: null,
    activityTypes: ['food', 'shopping'],
    tags: [],
    cityName: 'Taipei',
    location: { lat: 25.05, lng: 121.5, address: null },
    costBand: null,
    typicalDurationMinutes: null,
    sources: [],
    ...overrides,
});

describe('shared/tripIdeas', () => {
    const kept = idea('kept');
    const pending = idea('pending', { review: 'pending' });
    const skipped = idea('skipped', { review: 'skipped' });
    const unplaced = idea('unplaced', { review: 'pending', location: { lat: null, lng: null, address: 'Somewhere' } });

    it('treats an idea saved before review existed as kept', () => {
        expect(isIdeaPending(kept)).toBe(false);
        expect(listActiveIdeas([kept, pending, skipped])).toEqual([kept, pending]);
    });

    it('draws kept ideas full and pending ones faded, never skipped or unplaced ones', () => {
        const markers = buildMapIdeaMarkers([kept, pending, skipped, unplaced]);
        expect(markers.map(({ id, pending: isPending, type, lat, lng }) => ({ id, isPending, type, lat, lng }))).toEqual([
            { id: 'kept', isPending: false, type: 'food', lat: 25.05, lng: 121.5 },
            { id: 'pending', isPending: true, type: 'food', lat: 25.05, lng: 121.5 },
        ]);
        expect(buildMapIdeaMarkers(undefined)).toEqual([]);
    });

    it('carries what the pin card shows, with the post link rather than the map link', () => {
        const withSources = idea('src', {
            summary: 'Pepper buns',
            location: { lat: 25, lng: 121, address: 'Raohe St' },
            sources: [
                { kind: 'google_maps', handle: 'My map', url: 'https://www.google.com/maps/d/viewer?mid=x', capturedAt: null },
                { kind: 'instagram', handle: '@eats', url: 'https://www.instagram.com/p/1/', capturedAt: null },
            ],
        });
        expect(buildMapIdeaMarkers([withSources])[0]).toMatchObject({
            summary: 'Pepper buns',
            address: 'Raohe St',
            cityName: 'Taipei',
            source: { label: '@eats', url: 'https://www.instagram.com/p/1/' },
        });
    });

    it('saving and skipping are written explicitly, and restoring goes back to review', () => {
        const state = { saved: [pending, kept], dismissedIds: ['lib-1'] };
        const savedState = setIdeaReview(state, 'pending', 'saved');
        expect(savedState.saved[0].review).toBe('saved');
        expect(isIdeaPending(savedState.saved[0])).toBe(false);
        expect(savedState.saved[1]).toBe(kept);
        expect(savedState.dismissedIds).toEqual(['lib-1']);
        expect(setIdeaReview(state, 'kept', 'skipped').saved[1].review).toBe('skipped');
        expect(isIdeaPending(setIdeaReview(savedState, 'pending', 'pending').saved[0])).toBe(true);
    });

    it('treats a My Maps import from before review existed as still to review', () => {
        // The first imports stored no review at all; nobody ever decided on them.
        expect(isIdeaPending(idea('gmm-early'))).toBe(true);
        expect(isIdeaPending(idea('gmm-early', { review: 'saved' }))).toBe(false);
        // A library idea kept in the deck has no review either, and stays saved.
        expect(isIdeaPending(idea('taipei-101'))).toBe(false);
    });

    it('changes the map signature when a pin would look different', () => {
        const before = buildMapIdeaSignature(buildMapIdeaMarkers([pending]));
        const after = buildMapIdeaSignature(buildMapIdeaMarkers(setIdeaReview({ saved: [pending] }, 'pending', 'saved').saved));
        expect(after).not.toBe(before);
    });
});
