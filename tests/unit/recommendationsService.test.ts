import { describe, expect, it } from 'vitest';

import { buildRecommendationDeck } from '../../services/recommendationsService';
import type { Recommendation, RecommendationDataset } from '../../shared/recommendations';

const makeRecommendation = (overrides: Partial<Recommendation> & Pick<Recommendation, 'id'>): Recommendation => ({
    slug: overrides.id,
    countryCode: 'TW',
    cityName: 'Taipei',
    citySlug: 'taipei',
    location: {
        lat: 25, lng: 121, address: null, formattedAddress: null,
        geocodePrecision: 'approximate', googlePlaceId: null, geocodedAt: null,
    },
    locale: 'en',
    title: overrides.id,
    summary: '',
    description: null,
    activityTypes: ['food'],
    tags: [],
    costBand: null,
    costNote: null,
    typicalDurationMinutes: null,
    bestTimeOfDay: null,
    image: null,
    origin: 'import',
    sources: [],
    likeCount: 0,
    qualityScore: null,
    status: 'in_review',
    ...overrides,
});

const makeDataset = (recommendations: Recommendation[]): RecommendationDataset => ({
    countryCode: 'TW',
    countryName: 'Taiwan',
    generatedAt: '2026-09-16T00:00:00Z',
    sourceName: null,
    recommendations,
});

describe('services/recommendationsService buildRecommendationDeck', () => {
    it('returns an empty deck without a dataset', () => {
        expect(buildRecommendationDeck(null)).toEqual([]);
    });

    it('drops anything the traveller already decided on', () => {
        const dataset = makeDataset([
            makeRecommendation({ id: 'kept' }),
            makeRecommendation({ id: 'skipped' }),
            makeRecommendation({ id: 'fresh' }),
        ]);

        const deck = buildRecommendationDeck(dataset, { excludeIds: ['kept', 'skipped'] });
        expect(deck.map((entry) => entry.id)).toEqual(['fresh']);
    });

    it('keeps country-wide entries whatever the trip cities are', () => {
        const dataset = makeDataset([
            makeRecommendation({ id: 'anywhere', cityName: null, citySlug: null }),
            makeRecommendation({ id: 'tainan-only', cityName: 'Tainan' }),
        ]);

        const deck = buildRecommendationDeck(dataset, { cityNames: ['Taipei'] });
        expect(deck.map((entry) => entry.id)).toEqual(['anywhere']);
    });

    it('matches a city loosely, so "Taipei" reaches "New Taipei City"', () => {
        const dataset = makeDataset([makeRecommendation({ id: 'new-taipei', cityName: 'New Taipei City' })]);
        expect(buildRecommendationDeck(dataset, { cityNames: ['Taipei'] }).map((e) => e.id)).toEqual(['new-taipei']);
    });

    it('never offers a retired or rejected row', () => {
        const dataset = makeDataset([
            makeRecommendation({ id: 'live' }),
            makeRecommendation({ id: 'gone', status: 'retired' }),
            makeRecommendation({ id: 'no', status: 'rejected' }),
        ]);

        expect(buildRecommendationDeck(dataset).map((entry) => entry.id)).toEqual(['live']);
    });

    it('puts a card the traveller can act on first', () => {
        const dataset = makeDataset([
            makeRecommendation({
                id: 'vague',
                location: {
                    lat: null, lng: null, address: null, formattedAddress: null,
                    geocodePrecision: 'unknown', googlePlaceId: null, geocodedAt: null,
                },
            }),
            makeRecommendation({
                id: 'placed',
                description: 'Worth the walk',
                location: {
                    lat: 25, lng: 121, address: null, formattedAddress: null,
                    geocodePrecision: 'rooftop', googlePlaceId: null, geocodedAt: null,
                },
            }),
        ]);

        expect(buildRecommendationDeck(dataset, { cityNames: ['Taipei'] })[0].id).toBe('placed');
    });

    it('filters by activity type when one is asked for', () => {
        const dataset = makeDataset([
            makeRecommendation({ id: 'eat', activityTypes: ['food'] }),
            makeRecommendation({ id: 'walk', activityTypes: ['hiking'] }),
        ]);

        expect(buildRecommendationDeck(dataset, { activityTypes: ['hiking'] }).map((e) => e.id)).toEqual(['walk']);
    });

    it('is stable for rows that score the same', () => {
        const dataset = makeDataset([
            makeRecommendation({ id: 'a' }),
            makeRecommendation({ id: 'b' }),
            makeRecommendation({ id: 'c' }),
        ]);

        expect(buildRecommendationDeck(dataset).map((e) => e.id)).toEqual(['a', 'b', 'c']);
    });
});
