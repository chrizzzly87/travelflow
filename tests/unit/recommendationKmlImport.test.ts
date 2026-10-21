import { describe, expect, it } from 'vitest';

import {
    buildRecommendationFromPlacemark,
    enrichFromNote,
    parseKmlPlacemarks,
    parseRecommendationSources,
} from '../../scripts/lib/recommendationKmlImport';

describe('scripts/lib/recommendationKmlImport', () => {
    describe('parseRecommendationSources', () => {
        it('pairs each creator with their own post, not by position', () => {
            // The real export lists handles and URLs in different orders, so
            // pairing by index attributes a post to the wrong creator.
            const sources = parseRecommendationSources(
                '@daisywerld; @emails_to_airports; @leofromtaiwan',
                [
                    'https://www.instagram.com/leofromtaiwan/reel/Da1EirMygQI/',
                    'https://www.instagram.com/daisywerld/p/DbFY_rKDxhm/',
                    'https://www.instagram.com/emails_to_airports/reel/DYlx2HtIRiq/',
                ].join('; '),
                '2026-09-16',
            );

            expect(sources).toHaveLength(3);
            expect(sources.find((entry) => entry.handle === '@daisywerld')?.url)
                .toBe('https://www.instagram.com/daisywerld/p/DbFY_rKDxhm/');
            expect(sources.find((entry) => entry.handle === '@leofromtaiwan')?.url)
                .toBe('https://www.instagram.com/leofromtaiwan/reel/Da1EirMygQI/');
        });

        it('keeps a handle with no matching post, and never mis-attributes a spare URL', () => {
            const sources = parseRecommendationSources(
                '@someone',
                'https://www.instagram.com/other_person/reel/ABC/',
                '2026-09-16',
            );

            expect(sources.find((entry) => entry.handle === '@someone')?.url).toBeNull();
            const orphan = sources.find((entry) => entry.handle === null);
            expect(orphan?.url).toBe('https://www.instagram.com/other_person/reel/ABC/');
        });

        it('returns nothing when the pin cites no one', () => {
            expect(parseRecommendationSources(undefined, undefined, '2026-09-16')).toEqual([]);
        });
    });

    describe('enrichFromNote', () => {
        it('reads "free" before the generic budget words', () => {
            // 'Free 20-min hike' must not be filed as cheap-but-paid.
            const enriched = enrichFromNote('Free 20-min hike, best sunset/skyline view of Taipei 101');

            expect(enriched.costBand).toBe('free');
            expect(enriched.types).toContain('hiking');
            expect(enriched.tags).toContain('viewpoint');
            expect(enriched.durationMinutes).toBe(20);
            expect(enriched.bestTimeOfDay).toContain('evening');
        });

        it('keeps a budget signal when nothing is free', () => {
            const enriched = enrichFromNote('Michelin Bib Gourmand braised pork rice, budget-friendly (<$5)');

            expect(enriched.costBand).toBe('$');
            expect(enriched.costNote).toBe('$5');
            expect(enriched.tags).toContain('michelin');
        });

        it('averages a duration range and converts hours', () => {
            expect(enrichFromNote('A 2-4 hour boat tour').durationMinutes).toBe(180);
        });

        it('finds nothing in a note that says nothing', () => {
            const enriched = enrichFromNote('Nice place');
            expect(enriched.costBand).toBeNull();
            expect(enriched.types).toEqual([]);
            expect(enriched.durationMinutes).toBeNull();
        });
    });

    describe('buildRecommendationFromPlacemark', () => {
        const base = {
            countryCode: 'TW',
            capturedAt: '2026-09-16',
            geocode: null,
            existingSlugs: new Set<string>(),
        };

        it('merges the source category with what the note actually says', () => {
            const recommendation = buildRecommendationFromPlacemark({
                ...base,
                placemark: {
                    name: 'Elephant Mountain (Xiangshan)',
                    data: {
                        Category: 'Sights & Landmarks',
                        Area: 'Taipei',
                        Notes: 'Free 20-min hike, best sunset/skyline view of Taipei 101',
                        Location: 'Elephant Mountain, Taipei, Taiwan',
                    },
                },
            });

            expect(recommendation.activityTypes).toEqual(['sightseeing', 'hiking']);
            expect(recommendation.costBand).toBe('free');
            expect(recommendation.cityName).toBe('Taipei');
            expect(recommendation.tags).toContain('landmark');
            expect(recommendation.tags).toContain('taipei');
            // Nothing imported is trusted straight into the deck.
            expect(recommendation.status).toBe('in_review');
            expect(recommendation.origin).toBe('import');
        });

        it('treats a country-wide area as having no city', () => {
            const recommendation = buildRecommendationFromPlacemark({
                ...base,
                placemark: {
                    name: 'Convenience stores',
                    data: { Category: 'Shopping & Souvenirs', Area: 'Taiwan-wide', Notes: '' },
                },
            });

            expect(recommendation.cityName).toBeNull();
            expect(recommendation.citySlug).toBeNull();
        });

        it('keeps slugs unique within an import', () => {
            const slugs = new Set<string>();
            const first = buildRecommendationFromPlacemark({
                ...base,
                existingSlugs: slugs,
                placemark: { name: 'Night Market', data: { Category: 'Night Market', Area: 'Taipei' } },
            });
            const second = buildRecommendationFromPlacemark({
                ...base,
                existingSlugs: slugs,
                placemark: { name: 'Night Market', data: { Category: 'Night Market', Area: 'Tainan' } },
            });

            expect(first.slug).toBe('night-market');
            expect(second.slug).toBe('night-market-2');
        });

        it('records that an ungeocoded pin has no usable position', () => {
            const recommendation = buildRecommendationFromPlacemark({
                ...base,
                placemark: { name: 'Somewhere', data: { Category: 'Food & Drink', Area: 'Taipei' } },
            });

            expect(recommendation.location.lat).toBeNull();
            expect(recommendation.location.geocodePrecision).toBe('unknown');
        });
    });

    describe('parseKmlPlacemarks', () => {
        it('reads name and extended data, and decodes entities', () => {
            const kml = `
                <Placemark>
                  <name>Wang&#39;s Broth</name>
                  <ExtendedData>
                    <Data name="Category"><value>Food &amp; Drink</value></Data>
                    <Data name="Area"><value>Taipei</value></Data>
                  </ExtendedData>
                </Placemark>`;

            const placemarks = parseKmlPlacemarks(kml);
            expect(placemarks).toHaveLength(1);
            expect(placemarks[0].name).toBe("Wang's Broth");
            expect(placemarks[0].data.Category).toBe('Food & Drink');
        });

        it('skips a placemark with no name', () => {
            expect(parseKmlPlacemarks('<Placemark><name>  </name></Placemark>')).toEqual([]);
        });
    });
});
