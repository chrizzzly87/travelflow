import { describe, expect, it } from 'vitest';
import { parseRouteSearch, stringifyRouteSearch } from '../../app/routing/search';
import { parseTripRouteSearch, tripRouteSearchSchema } from '../../features/trips/tripRouteSearch';
import { createTripRouteSearchSchema, parseCreateTripRouteSearch } from '../../features/trips/createTripRouteSearch';
import { tripLoaderDeps } from '../../features/trips/routeData';

/** What the router does: parse with the flat codec, validate, stringify. */
const roundTrip = (schema: (input: unknown) => Record<string, unknown>, searchStr: string) => {
    const raw = parseRouteSearch(searchStr);
    return stringifyRouteSearch({ ...raw, ...schema(raw) });
};

describe('trip route search schema', () => {
    it('adds no defaults to an empty query', () => {
        expect(parseTripRouteSearch({})).toEqual({});
        expect(Object.keys(parseTripRouteSearch({}))).toEqual([]);
        expect(roundTrip(tripRouteSearchSchema, '')).toBe('');
    });

    it('reads version, claim and view settings as written', () => {
        expect(parseTripRouteSearch(parseRouteSearch('?v=ver-2&claim=%20req-1%20&claim_conflict=already_claimed&discover=1&mode=print&layout=vertical&timelineMode=timeline&timelineView=horizontal&mapStyle=cleanDark&routeMode=realistic&cityNames=0&zoom=1.50&sidebarWidth=480&detailsWidth=420&timelineHeight=320'))).toEqual({
            v: 'ver-2',
            claim: ' req-1 ',
            claim_conflict: 'already_claimed',
            discover: '1',
            mode: 'print',
            layout: 'vertical',
            timelineMode: 'timeline',
            timelineView: 'horizontal',
            mapStyle: 'cleanDark',
            routeMode: 'realistic',
            cityNames: '0',
            zoom: '1.50',
            sidebarWidth: '480',
            detailsWidth: '420',
            timelineHeight: '320',
        });
    });

    it('keeps valid and legacy share URLs byte-for-byte, including unknown parameters', () => {
        for (const searchStr of [
            '?v=8f1d2c3e-0000-4000-8000-000000000000',
            '?layout=horizontal&timelineMode=calendar&timelineView=horizontal&mapStyle=standard&routeMode=simple&cityNames=1&zoom=1.25&sidebarWidth=480&detailsWidth=420&timelineHeight=320&mode=print',
            '?internal=1&utm_source=newsletter&v=abc',
            '?tag=a&tag=b&zoom=2.00',
        ]) expect(roundTrip(tripRouteSearchSchema, searchStr)).toBe(searchStr);
    });

    it('never throws on invalid values and reads them as absent', () => {
        const parsed = parseTripRouteSearch(parseRouteSearch('?v=a&v=b&mode=planner&layout=diagonal&mapStyle=neon&cityNames=yes&zoom=big&discover=true&keep=me'));
        expect(parsed).toMatchObject({ keep: 'me' });
        for (const key of ['v', 'mode', 'layout', 'mapStyle', 'cityNames', 'zoom', 'discover'] as const) expect(parsed[key]).toBeUndefined();
        expect(() => parseTripRouteSearch(null)).not.toThrow();
        expect(parseTripRouteSearch('not an object')).toEqual({});
        expect(tripRouteSearchSchema({ v: 3, zoom: { nested: true } })).toEqual({ v: undefined, zoom: undefined });
        expect(parseTripRouteSearch(['v'])).toEqual({});
    });

    it('feeds only the version to the trip loader', () => {
        expect(tripLoaderDeps({ search: parseTripRouteSearch(parseRouteSearch('?v=ver-1&layout=vertical&zoom=2.00')) })).toEqual({ versionId: 'ver-1' });
        expect(tripLoaderDeps({ search: parseTripRouteSearch(parseRouteSearch('?layout=vertical')) })).toEqual({ versionId: undefined });
        // A repeated version is not a version; the current trip loads as before.
        expect(tripLoaderDeps({ search: parseTripRouteSearch(parseRouteSearch('?v=a&v=b')) })).toEqual({ versionId: undefined });
    });
});

describe('create-trip route search schema', () => {
    it('adds no defaults and keeps the encoded draft as written', () => {
        expect(parseCreateTripRouteSearch({})).toEqual({});
        expect(parseCreateTripRouteSearch(parseRouteSearch('?prefill=eyJjb3VudHJpZXMiOlsiSmFwYW4iXX0'))).toEqual({ prefill: 'eyJjb3VudHJpZXMiOlsiSmFwYW4iXX0' });
        expect(roundTrip(createTripRouteSearchSchema, '?source=landing&prefill=eyJ4IjoxfQ')).toBe('?source=landing&prefill=eyJ4IjoxfQ');
    });

    it('reads a repeated or non-string draft as absent without throwing', () => {
        expect(parseCreateTripRouteSearch(parseRouteSearch('?prefill=a&prefill=b&source=x'))).toEqual({ prefill: undefined, source: 'x' });
        expect(() => parseCreateTripRouteSearch({ prefill: 42 })).not.toThrow();
    });
});
