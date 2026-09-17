import { describe, expect, it } from 'vitest';

import {
    recommendationToRow,
    rowToRecommendation,
    validateRecommendationDraft,
    type RecommendationRow,
} from '../../shared/recommendationRows';
import type { Recommendation } from '../../shared/recommendations';

const row = (overrides: Partial<RecommendationRow> = {}): RecommendationRow => ({
    id: 'rec_tw_a',
    slug: 'a',
    country_code: 'tw',
    city_name: 'Taipei',
    city_slug: 'taipei',
    lat: 25,
    lng: 121,
    address: 'Somewhere',
    formatted_address: 'Somewhere, Taipei',
    geocode_precision: 'rooftop',
    google_place_id: 'ChIJ123',
    geocoded_at: '2026-09-16',
    locale: 'en',
    title: 'Place A',
    summary: 'A summary',
    description: 'A description',
    highlights: ['One', 'Two'],
    activity_types: ['food'],
    tags: ['taipei'],
    cost_band: '$$',
    cost_note: null,
    typical_duration_minutes: 75,
    best_time_of_day: ['evening'],
    image: { url: '/api/place-photo?ref=x', provider: 'google_places', attribution: 'Tom', authorUrl: null, blurhash: null },
    origin: 'import',
    sources: [{ kind: 'instagram', handle: '@who', url: 'https://example.test', capturedAt: null }],
    like_count: 3,
    quality_score: 4.5,
    status: 'published',
    ...overrides,
});

describe('shared/recommendationRows', () => {
    it('reads a row into the shape the cards render', () => {
        const recommendation = rowToRecommendation(row());

        expect(recommendation.countryCode).toBe('TW');
        expect(recommendation.location.lat).toBe(25);
        expect(recommendation.highlights).toEqual(['One', 'Two']);
        expect(recommendation.image?.attribution).toBe('Tom');
        expect(recommendation.sources[0].handle).toBe('@who');
        expect(recommendation.status).toBe('published');
    });

    it('survives a row written by hand, with nulls and stringified json', () => {
        const recommendation = rowToRecommendation(row({
            city_name: null,
            highlights: '["Typed by hand"]',
            activity_types: null,
            tags: undefined as unknown as null,
            image: null,
            sources: 'not json at all',
            // PostgREST sends `numeric` as a string, which would become NaN.
            quality_score: '2.5' as unknown as number,
            geocode_precision: 'made up',
            status: 'made up',
            locale: null,
        }));

        expect(recommendation.cityName).toBeNull();
        expect(recommendation.highlights).toEqual(['Typed by hand']);
        expect(recommendation.activityTypes).toEqual([]);
        expect(recommendation.tags).toEqual([]);
        expect(recommendation.image).toBeNull();
        expect(recommendation.sources).toEqual([]);
        expect(recommendation.qualityScore).toBe(2.5);
        expect(recommendation.location.geocodePrecision).toBe('unknown');
        expect(recommendation.status).toBe('draft');
        expect(recommendation.locale).toBe('en');
    });

    it('drops an image with no url rather than rendering a broken one', () => {
        expect(rowToRecommendation(row({ image: { provider: 'google_places' } })).image).toBeNull();
    });

    it('round-trips a recommendation through a row without losing anything', () => {
        const original = rowToRecommendation(row());
        const restored = rowToRecommendation(recommendationToRow(original) as RecommendationRow);
        expect(restored).toEqual(original);
    });

    it('leaves highlights undefined when there are none, so the block is not drawn', () => {
        expect(rowToRecommendation(row({ highlights: [] })).highlights).toBeUndefined();
    });

    describe('validateRecommendationDraft', () => {
        it('accepts what an editor typed and derives the id and slug', () => {
            const result = validateRecommendationDraft({
                title: '  Din Tai Fung (Xinsheng Branch) ',
                countryCode: 'tw',
                highlights: ['Order the xiaolongbao', '  '],
                tags: ['food-drink'],
            });

            expect('row' in result).toBe(true);
            if (!('row' in result)) return;
            expect(result.row.slug).toBe('din-tai-fung-xinsheng-branch');
            expect(result.row.id).toBe('rec_tw_din-tai-fung-xinsheng-branch');
            expect(result.row.country_code).toBe('TW');
            expect(result.row.highlights).toEqual(['Order the xiaolongbao']);
            // Nothing an editor creates is public until they say so.
            expect(result.row.status).toBe('draft');
        });

        it('keeps an id it was given, so an edit is not a new row', () => {
            const result = validateRecommendationDraft({ id: 'rec_tw_a', title: 'Place A', countryCode: 'TW' });
            expect('row' in result && result.row.id).toBe('rec_tw_a');
        });

        it('says which field is wrong instead of leaving it to Postgres', () => {
            expect(validateRecommendationDraft({ countryCode: 'TW' })).toEqual({ error: 'A title is required.' });
            expect(validateRecommendationDraft({ title: 'X', countryCode: 'TAIWAN' }))
                .toEqual({ error: 'A two-letter country code is required.' });
            expect(validateRecommendationDraft({ title: 'X', countryCode: 'TW', status: 'live' }))
                .toEqual({ error: 'Status must be one of draft, in review, published, rejected or retired.' });
            expect(validateRecommendationDraft({ title: 'X', countryCode: 'TW', costBand: 'cheap' }))
                .toEqual({ error: 'Cost must be free, $, $$, $$$ or $$$$.' });
            expect(validateRecommendationDraft({ title: 'X', countryCode: 'TW', lat: 120 }))
                .toEqual({ error: 'Latitude must be between -90 and 90.' });
            expect(validateRecommendationDraft({ title: '???', countryCode: 'TW' }))
                .toEqual({ error: 'The title must contain at least one letter or digit.' });
        });

        it('reads coordinates from a nested location, which is how the app carries them', () => {
            const result = validateRecommendationDraft({
                title: 'Place',
                countryCode: 'TW',
                location: { lat: 25.03, lng: 121.53 },
            });
            expect('row' in result && result.row.lat).toBe(25.03);
            expect('row' in result && result.row.lng).toBe(121.53);
        });

        it('accepts a whole recommendation object, which is what the import sends', () => {
            const recommendation: Recommendation = rowToRecommendation(row());
            const result = validateRecommendationDraft({
                ...recommendation,
                lat: recommendation.location.lat,
                lng: recommendation.location.lng,
            });
            expect('row' in result).toBe(true);
            if (!('row' in result)) return;
            expect(result.row.id).toBe('rec_tw_a');
            expect(result.row.status).toBe('published');
            expect(result.row.highlights).toEqual(['One', 'Two']);
        });
    });
});
