// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    buildMyMapsKmlUrl,
    flattenMyMapsHtml,
    mapMyMapsCategoryToActivityTypes,
    mergeImportedIdeas,
    myMapsPlacemarkToSavedIdea,
    parseMyMapsId,
    parseMyMapsKml,
    MyMapsParseError,
    selectNewIdeas,
} from '../../shared/googleMyMaps';

const fixture = readFileSync(
    path.join(__dirname, '../fixtures/googleMyMaps/address-only-layer.kml'),
    'utf8',
);

const context = { mapName: 'Taiwan Saved Posts', mapUrl: 'https://www.google.com/maps/d/viewer?mid=abc', savedAt: '2026-09-28T10:00:00.000Z' };

describe('parseMyMapsId', () => {
    it('reads the id from every link shape My Maps hands out', () => {
        const id = '1hxHkP7Do3tWUF6vpG045IfL5UbQ7i90';
        expect(parseMyMapsId(`google.com/maps/d/edit?mid=${id}&usp=sharing`)).toBe(id);
        expect(parseMyMapsId(`https://www.google.com/maps/d/viewer?mid=${id}`)).toBe(id);
        expect(parseMyMapsId(`https://www.google.com/maps/d/u/0/edit?mid=${id}&ll=25,121&z=12`)).toBe(id);
        expect(parseMyMapsId(`https://www.google.de/maps/d/embed?mid=${id}`)).toBe(id);
        expect(parseMyMapsId(`  ${id}  `)).toBe(id);
    });

    it('refuses links that are not My Maps', () => {
        expect(parseMyMapsId('https://maps.app.goo.gl/abcdef')).toBeNull();
        expect(parseMyMapsId('https://www.google.com/maps/place/Taipei+101')).toBeNull();
        expect(parseMyMapsId('https://evil.example/maps/d/edit?mid=1hxHkP7Do3tWUF6vpG045IfL5UbQ7i90')).toBeNull();
        expect(parseMyMapsId('taipei')).toBeNull();
        expect(parseMyMapsId('')).toBeNull();
    });

    it('builds the KML download link', () => {
        expect(buildMyMapsKmlUrl('abc_DEF-123')).toBe('https://www.google.com/maps/d/kml?mid=abc_DEF-123&forcekml=1');
    });
});

describe('parseMyMapsKml', () => {
    it('keeps address-only pins, which is what a spreadsheet-built layer exports', () => {
        const document = parseMyMapsKml(fixture);
        expect(document.name).toBe('Taiwan Saved Posts');
        expect(document.placemarks).toHaveLength(5);
        const [first] = document.placemarks;
        expect(first.name).toBe('Taipei 101 Observatory');
        expect(first.address).toBe('Taipei 101, Taipei, Taiwan');
        expect(first.coordinates).toBeNull();
        expect(first.folder).toBe('All Saved Places');
        expect(first.data.Category).toBe('Sights & Landmarks');
    });

    it('reads point pins as lat/lng, not the lng/lat KML writes', () => {
        const pin = parseMyMapsKml(fixture).placemarks.find((entry) => entry.name === 'Elephant Mountain trailhead');
        expect(pin?.coordinates).toEqual({ lat: 25.0272, lng: 121.5767 });
        expect(pin?.description).toBe('Short, steep climb.\nBest view of Taipei 101.');
    });

    it('counts lines and shapes instead of importing them', () => {
        expect(parseMyMapsKml(fixture).skippedShapeCount).toBe(1);
    });

    it('rejects something that is not KML', () => {
        expect(() => parseMyMapsKml('<html><body>Sign in</body></html>')).toThrow(MyMapsParseError);
        expect(() => parseMyMapsKml('not xml at all <')).toThrow(MyMapsParseError);
    });

    it('rejects a map with nothing on it', () => {
        expect(() => parseMyMapsKml('<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Empty</name></Document></kml>'))
            .toThrow(expect.objectContaining({ code: 'empty' }));
    });
});

describe('flattenMyMapsHtml', () => {
    it('turns breaks into lines and drops markup and entities', () => {
        expect(flattenMyMapsHtml('One<br>Two &amp; <a href="x">three</a><br/>')).toBe('One\nTwo & three');
    });
});

describe('mapMyMapsCategoryToActivityTypes', () => {
    it('reads each half of a two-part category', () => {
        expect(mapMyMapsCategoryToActivityTypes('Food & Drink')).toEqual(['food']);
        expect(mapMyMapsCategoryToActivityTypes('Sights & Landmarks')).toEqual(['sightseeing']);
        expect(mapMyMapsCategoryToActivityTypes('Nature & Day Trips')).toEqual(['nature']);
        expect(mapMyMapsCategoryToActivityTypes('Shopping & Souvenirs')).toEqual(['shopping']);
        expect(mapMyMapsCategoryToActivityTypes('Nightlife')).toEqual(['nightlife']);
    });

    it('treats a night market as food and shopping, not nightlife', () => {
        expect(mapMyMapsCategoryToActivityTypes('Night Market')).toEqual(['food', 'shopping']);
    });

    it('falls back to general', () => {
        expect(mapMyMapsCategoryToActivityTypes('Activities & Experiences')).toEqual(['general']);
        expect(mapMyMapsCategoryToActivityTypes(null)).toEqual(['general']);
    });
});

describe('myMapsPlacemarkToSavedIdea', () => {
    const placemarks = parseMyMapsKml(fixture).placemarks;

    it('maps the layer columns onto the idea', () => {
        const idea = myMapsPlacemarkToSavedIdea(placemarks[0], context);
        expect(idea.title).toBe('Taipei 101 Observatory');
        expect(idea.cityName).toBe('Taipei');
        expect(idea.activityTypes).toEqual(['sightseeing']);
        expect(idea.tags).toEqual(['sights-landmarks']);
        // Only the notes, not the "Category: …" echo My Maps writes into descriptions.
        expect(idea.description).toBe('Go at sunset & stay for the city lights');
        expect(idea.summary).toBe('Go at sunset & stay for the city lights');
        expect(idea.location).toEqual({ lat: null, lng: null, address: 'Taipei 101, Taipei, Taiwan' });
        expect(idea.sources).toEqual([
            {
                kind: 'instagram',
                handle: '@example_traveller',
                url: 'https://www.instagram.com/example_traveller/reel/ABC123/',
                capturedAt: null,
            },
            { kind: 'google_maps', handle: 'Taiwan Saved Posts', url: context.mapUrl, capturedAt: context.savedAt },
        ]);
        expect(idea.recommendationId).toMatch(/^gmm-[a-z0-9]+$/);
        // Imported ideas wait for the traveller's decision.
        expect(idea.review).toBe('pending');
    });

    it('keeps the plain description of a pin without a table', () => {
        const idea = myMapsPlacemarkToSavedIdea(placemarks[4], context);
        expect(idea.description).toBe('Short, steep climb.\nBest view of Taipei 101.');
        expect(idea.summary).toBe('Short, steep climb.');
        expect(idea.location).toEqual({ lat: 25.0272, lng: 121.5767, address: null });
    });

    it('gives the same pin the same id on every import', () => {
        const first = myMapsPlacemarkToSavedIdea(placemarks[2], context);
        const again = myMapsPlacemarkToSavedIdea(placemarks[2], { ...context, mapUrl: null, savedAt: 'later' });
        expect(again.recommendationId).toBe(first.recommendationId);
        expect(myMapsPlacemarkToSavedIdea(placemarks[0], context).recommendationId).not.toBe(first.recommendationId);
    });
});

describe('mergeImportedIdeas', () => {
    const [taipei101, raohe] = parseMyMapsKml(fixture).placemarks
        .map((placemark) => myMapsPlacemarkToSavedIdea(placemark, context));

    it('adds only what is new, and a re-import adds nothing', () => {
        const first = mergeImportedIdeas({ saved: [], dismissedIds: [] }, [taipei101, raohe]);
        expect(first.addedCount).toBe(2);
        const second = mergeImportedIdeas(first.next, [taipei101, raohe]);
        expect(second.addedCount).toBe(0);
        expect(second.next.saved).toHaveLength(2);
    });

    it('keeps whatever the trip already has, including a skipped idea', () => {
        const edited = { ...taipei101, title: 'Edited by the traveller' };
        const skipped = { ...raohe, review: 'skipped' as const };
        const { next, addedCount } = mergeImportedIdeas(
            { saved: [edited, skipped], dismissedIds: ['other'] },
            [taipei101, raohe],
        );
        expect(addedCount).toBe(0);
        expect(next.saved).toEqual([edited, skipped]);
        expect(next.dismissedIds).toEqual(['other']);
    });
});

describe('selectNewIdeas', () => {
    const [taipei101, raohe, jiufen] = parseMyMapsKml(fixture).placemarks
        .map((placemark) => myMapsPlacemarkToSavedIdea(placemark, context));

    it('skips ideas already kept and places already planned onto a day', () => {
        const fresh = selectNewIdeas([taipei101, raohe, jiufen], {
            keptIdeaIds: [raohe.recommendationId],
            // Planning an idea removes it from the kept list; the activity keeps its title.
            activityTitles: ['  taipei 101   OBSERVATORY '],
        });
        expect(fresh.map((idea) => idea.title)).toEqual(['Jiufen Old Street']);
    });
});
