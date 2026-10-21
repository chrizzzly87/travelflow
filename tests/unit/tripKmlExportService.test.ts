// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import type { ITrip } from '../../types';
import { buildTripKml } from '../../services/tripKmlExportService';
import { buildMyMapsPlacemarkId, parseMyMapsKml } from '../../shared/googleMyMaps';
import type { SavedRecommendation } from '../../shared/recommendations';

const labels = { route: 'Route', stops: 'Stops', activities: 'Activities', dayTrips: 'Day trips', ideas: 'Ideas' };

const trip: ITrip = {
    id: 'trip-tw',
    title: 'Taiwan <Spring> & more',
    startDate: '2026-04-10',
    createdAt: 1,
    updatedAt: 1,
    items: [
        { id: 'taipei', type: 'city', title: 'Taipei', location: 'Taipei, Taiwan', startDateOffset: 0, duration: 4, color: '', coordinates: { lat: 25.033, lng: 121.5654 }, hotels: [{ id: 'h', name: 'Ximen Inn', address: '' }] },
        { id: 'tainan', type: 'city', title: 'Tainan', location: 'Tainan, Taiwan', startDateOffset: 4, duration: 3, color: '', coordinates: { lat: 22.9999, lng: 120.2269 } },
        { id: 'nowhere', type: 'city', title: 'Unmapped', startDateOffset: 7, duration: 1, color: '' },
        { id: 'a1', type: 'activity', title: 'Taipei 101', startDateOffset: 1.4, duration: 0.1, color: '', coordinates: { lat: 25.0339, lng: 121.5645 }, stayCityId: 'taipei', link: 'https://example.com/101' },
        { id: 'a2', type: 'activity', title: 'Jiufen', activityKind: 'day-trip', startDateOffset: 2.3, duration: 0.4, color: '', coordinates: { lat: 25.1092, lng: 121.8452 }, stayCityId: 'taipei' },
        { id: 'a3', type: 'activity', title: 'Somewhere vague', startDateOffset: 5, duration: 0.1, color: '' },
        { id: 't1', type: 'travel', title: 'HSR', startDateOffset: 3.9, duration: 0.1, color: '', transportMode: 'train' },
    ],
};

const idea = (overrides: Partial<SavedRecommendation>): SavedRecommendation => ({
    recommendationId: 'gmm-x',
    savedAt: '2026-09-28T00:00:00Z',
    title: 'Raohe Night Market',
    summary: 'Pepper buns',
    description: 'Pepper buns at the temple gate',
    activityTypes: ['food'],
    tags: [],
    cityName: 'Taipei',
    location: { lat: 25.0508, lng: 121.5775, address: 'Raohe St, Taipei' },
    costBand: null,
    typicalDurationMinutes: null,
    sources: [{ kind: 'instagram', handle: '@x', url: 'https://www.instagram.com/p/1/', capturedAt: null }],
    ...overrides,
});

describe('buildTripKml', () => {
    const bundle = buildTripKml({
        trip,
        labels,
        ideas: [idea({}), idea({ recommendationId: 'gmm-y', title: 'No position', location: { lat: null, lng: null, address: 'x' } })],
        locale: 'en-GB',
    });

    it('writes one My Maps layer per kind of place', () => {
        const folders = [...bundle.kml.matchAll(/<Folder id="[^"]+"><name>([^<]+)<\/name>/g)].map((match) => match[1]);
        expect(folders).toEqual(['Route', 'Stops', 'Activities', 'Day trips', 'Ideas']);
    });

    it('draws the route through the stops in order, in lng,lat', () => {
        expect(bundle.kml).toContain('<LineString><tessellate>1</tessellate><coordinates>121.565400,25.033000,0 120.226900,22.999900,0</coordinates></LineString>');
    });

    it('puts dates, the hotel and the stay into descriptions', () => {
        expect(bundle.kml).toContain('<description>10 Apr – 14 Apr\n🛏 Ximen Inn</description>');
        expect(bundle.kml).toContain('<description>11 Apr · Taipei\nhttps://example.com/101</description>');
    });

    it('escapes the trip title', () => {
        expect(bundle.kml).toContain('<name>Taiwan &lt;Spring&gt; &amp; more</name>');
        expect(bundle.fileName).not.toMatch(/[<>&\s]/);
    });

    it('leaves out places without a position and counts them', () => {
        expect(bundle.placeCount).toBe(5);
        expect(bundle.skippedCount).toBe(3);
        expect(bundle.kml).not.toContain('Somewhere vague');
        expect(bundle.kml).not.toContain('No position');
    });

    it('reads back through the importer, without the stops', () => {
        const document = parseMyMapsKml(bundle.kml);
        expect(document.name).toBe('Taiwan <Spring> & more');
        expect(document.skippedShapeCount).toBe(1);
        expect(document.placemarks.map((placemark) => [placemark.folder, placemark.name])).toEqual([
            ['Activities', 'Taipei 101'],
            ['Day trips', 'Jiufen'],
            ['Ideas', 'Raohe Night Market'],
        ]);
        expect(document.placemarks[2].coordinates).toEqual({ lat: 25.0508, lng: 121.5775 });
    });

    it('round-trips an idea to the same id, even after it gained a position', () => {
        const exported = parseMyMapsKml(bundle.kml).placemarks[2];
        const original = { ...exported, coordinates: null, description: null };
        expect(buildMyMapsPlacemarkId(exported)).toBe(buildMyMapsPlacemarkId(original));
    });
});
