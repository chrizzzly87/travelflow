import { describe, expect, it } from 'vitest';

import {
    buildActivityFromSavedRecommendation,
    formatCostBandLabel,
    normalizeRecommendationTag,
    toSavedRecommendation,
    type Recommendation,
    type SavedRecommendation,
} from '../../shared/recommendations';

const recommendation: Recommendation = {
    id: 'rec_tw_elephant-mountain',
    slug: 'elephant-mountain',
    countryCode: 'TW',
    cityName: 'Taipei',
    citySlug: 'taipei',
    location: {
        lat: 25.027223,
        lng: 121.576499,
        address: 'Elephant Mountain, Taipei, Taiwan',
        formattedAddress: '110, Taiwan, Taipei, Xinyi District',
        geocodePrecision: 'approximate',
        googlePlaceId: 'ChIJabc',
        geocodedAt: '2026-09-16',
    },
    locale: 'en',
    title: 'Elephant Mountain (Xiangshan)',
    summary: 'Free 20-min hike',
    description: 'Free 20-min hike, best sunset/skyline view of Taipei 101',
    activityTypes: ['sightseeing', 'hiking'],
    tags: ['landmark', 'viewpoint'],
    costBand: 'free',
    costNote: null,
    typicalDurationMinutes: 20,
    bestTimeOfDay: ['evening'],
    image: null,
    origin: 'import',
    sources: [{ kind: 'instagram', handle: '@daisywerld', url: 'https://example.test/p', capturedAt: '2026-09-16' }],
    likeCount: 0,
    qualityScore: null,
    status: 'in_review',
};

describe('shared/recommendations', () => {
    describe('toSavedRecommendation', () => {
        it('copies the content rather than referencing the library row', () => {
            const saved = toSavedRecommendation(recommendation, '2026-09-16T10:00:00Z');

            expect(saved.recommendationId).toBe(recommendation.id);
            expect(saved.title).toBe(recommendation.title);
            expect(saved.activityTypes).toEqual(['sightseeing', 'hiking']);

            // Mutating the copy must not reach back into the library row.
            saved.activityTypes.push('food');
            saved.sources[0].handle = '@someone-else';
            expect(recommendation.activityTypes).toEqual(['sightseeing', 'hiking']);
            expect(recommendation.sources[0].handle).toBe('@daisywerld');
        });

        it('prefers the geocoded address over the one the source gave', () => {
            const saved = toSavedRecommendation(recommendation, '2026-09-16T10:00:00Z');
            expect(saved.location.address).toBe('110, Taiwan, Taipei, Xinyi District');
        });
    });

    describe('buildActivityFromSavedRecommendation', () => {
        const saved: SavedRecommendation = toSavedRecommendation(recommendation, '2026-09-16T10:00:00Z');

        it('places the activity on the chosen day with its own duration', () => {
            const activity = buildActivityFromSavedRecommendation(saved, 4);

            expect(activity.startDateOffset).toBe(4);
            // 20 minutes as a fraction of a day.
            expect(activity.duration).toBeCloseTo(20 / 1440, 6);
            expect(activity.activityType).toEqual(['sightseeing', 'hiking']);
            expect(activity.coordinates).toEqual({ lat: 25.027223, lng: 121.576499 });
        });

        it('falls back to a sensible length when the source never said one', () => {
            const activity = buildActivityFromSavedRecommendation(
                { ...saved, typicalDurationMinutes: null },
                0,
            );
            expect(activity.duration).toBeCloseTo(90 / 1440, 6);
        });

        it('omits coordinates rather than inventing them', () => {
            const activity = buildActivityFromSavedRecommendation(
                { ...saved, location: { lat: null, lng: null, address: null } },
                2,
            );

            expect(activity.coordinates).toBeUndefined();
            // Without an address it still names the city, so the map can fall back.
            expect(activity.location).toBe('Taipei');
        });

        it('uses the summary when there is no description', () => {
            const activity = buildActivityFromSavedRecommendation(
                { ...saved, description: null },
                0,
            );
            expect(activity.description).toBe('Free 20-min hike');
        });
    });

    describe('formatting helpers', () => {
        it('spells out free and leaves the bands alone', () => {
            expect(formatCostBandLabel('free')).toBe('Free');
            expect(formatCostBandLabel('$$')).toBe('$$');
            expect(formatCostBandLabel(null)).toBeNull();
        });

        it('normalizes a tag to something searchable', () => {
            expect(normalizeRecommendationTag('New Taipei City')).toBe('new-taipei-city');
            expect(normalizeRecommendationTag('  Night Market!  ')).toBe('night-market');
        });
    });
});
