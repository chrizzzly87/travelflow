import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPublicProfileHead, getPublicProfileCacheHeaders } from '../../features/profile/publicProfileDocument';
import { publicDocumentCacheHeaders, publicProfileDocumentCacheHeaders } from '../../app/routing/cachePolicy';
import { parsePublicProfilePageData, type PublicProfilePageData } from '../../shared/publicProfile';

const mocks = vi.hoisted(() => ({ load: vi.fn(async (_handle: string | null) => ({ status: 'not_found' })) }));
vi.mock('@tanstack/react-start', () => ({
    createServerFn: () => ({ validator: (validate: (value: unknown) => unknown) => ({
        handler: (handle: (input: { data: unknown }) => unknown) => ({ data }: { data: unknown }) => handle({ data: validate(data) }),
    }) }),
}));
vi.mock('../../services/publicProfileServerService', () => ({ loadPublicProfilePageData: mocks.load }));
import { getPublicProfilePageData } from '../../src/server/publicProfile';

afterEach(() => mocks.load.mockClear());

const t = (key: string, options?: Record<string, unknown>) => (options?.name ? `${key}:${options.name}` : key);
const origin = 'https://travelflowapp.netlify.app';

const found = (bio = ''): PublicProfilePageData => ({
    status: 'found',
    profile: { id: 'user-1', username: 'traveler', usernameDisplay: 'Traveler', displayName: 'Traveler One', firstName: 'Traveler', lastName: 'One', bio, country: 'DE', city: 'Hamburg' },
    tripsPage: { trips: [], hasMore: false, nextOffset: 0 },
    tripsFailed: false,
});

const metaMap = (head: ReturnType<typeof buildPublicProfileHead>): Record<string, string> => Object.fromEntries(head.meta.map(entry => (
    'title' in entry ? ['title', entry.title ?? ''] : [entry.name ?? entry.property ?? '', entry.content ?? '']
)));

describe('public profile head', () => {
    it('names the traveler in the title, description and Open Graph tags, and is never indexed', () => {
        const meta = metaMap(buildPublicProfileHead({ data: found(), t, locale: 'en', origin }));
        expect(meta.title).toBe('Traveler One · TravelFlow');
        expect(meta['og:title']).toBe('Traveler One · TravelFlow');
        expect(meta.description).toBe('publicProfile.metaDescription:Traveler One');
        expect(meta['og:description']).toBe(meta.description);
        expect(meta.robots).toBe('noindex');
        const image = new URL(meta['og:image']);
        expect(`${image.origin}${image.pathname}`).toBe(`${origin}/api/og/site`);
        expect(image.searchParams.get('title')).toBe('Traveler One');
        expect(image.searchParams.get('path')).toBe('/u/traveler');
        expect(image.searchParams.get('lang')).toBe('en');
    });

    it('uses the public bio as the description, collapsed and shortened for previews', () => {
        const bio = `Slow   travel\nfan. ${'Mountains and coffee. '.repeat(20)}`;
        const meta = metaMap(buildPublicProfileHead({ data: found(bio), t, locale: 'de', origin }));
        expect(meta.description.startsWith('Slow travel fan.')).toBe(true);
        expect(meta.description.length).toBeLessThanOrEqual(160);
        expect(meta.description.endsWith('…')).toBe(true);
        expect(new URL(meta['og:image']).searchParams.get('lang')).toBe('de');
    });

    it('marks right-to-left locales in the image', () => {
        const meta = metaMap(buildPublicProfileHead({ data: found(), t, locale: 'fa', origin }));
        expect(new URL(meta['og:image']).searchParams.get('dir')).toBe('rtl');
    });

    it.each([
        [{ status: 'private', preview: { username: 'traveler', usernameDisplay: 'traveler', displayName: 'Traveler O.', firstName: 'Traveler', lastInitial: 'O' } }, 'publicProfile.privateTitle', 'publicProfile.privateDescription'],
        [{ status: 'not_found' }, 'publicProfile.notFoundTitle', 'publicProfile.notFoundDescription'],
        [{ status: 'unavailable' }, 'publicProfile.notFoundTitle', 'publicProfile.notFoundDescription'],
    ] as Array<[PublicProfilePageData, string, string]>)('keeps a %o profile anonymous and out of search', (data, title, description) => {
        const meta = metaMap(buildPublicProfileHead({ data, t, locale: 'en', origin }));
        expect(meta.title).toBe(`${title} · TravelFlow`);
        expect(meta.description).toBe(description);
        expect(meta.robots).toBe('noindex, nofollow');
        expect(JSON.stringify(meta)).not.toContain('Traveler');
    });
});

describe('public profile cache policy', () => {
    it('lets the CDN keep profiles for minutes, not the hour other public pages get', () => {
        const cdn = publicProfileDocumentCacheHeaders['netlify-cdn-cache-control'];
        const maxAge = Number(/s-maxage=(\d+)/.exec(cdn)?.[1]);
        const stale = Number(/stale-while-revalidate=(\d+)/.exec(cdn)?.[1]);
        expect(maxAge).toBeGreaterThanOrEqual(60);
        expect(maxAge + stale).toBeLessThanOrEqual(600);
        expect(cdn).toContain('public');
        expect(publicProfileDocumentCacheHeaders['cache-control']).toBe(publicDocumentCacheHeaders['cache-control']);
    });

    it.each([
        [found(), publicProfileDocumentCacheHeaders],
        [{ status: 'not_found' }, publicProfileDocumentCacheHeaders],
        [{ status: 'private', preview: { username: 'a', usernameDisplay: 'a', displayName: 'A', firstName: 'A', lastInitial: '' } }, publicProfileDocumentCacheHeaders],
        [{ status: 'unavailable' }, { 'cache-control': 'no-store' }],
        [{ ...found(), tripsFailed: true }, { 'cache-control': 'no-store' }],
        [undefined, { 'cache-control': 'no-store' }],
    ] as Array<[PublicProfilePageData | undefined, Record<string, string>]>)('caches %o with the matching headers', (data, expected) => {
        expect(getPublicProfileCacheHeaders(data)).toEqual(expected);
    });
});

describe('public profile server function', () => {
    it('normalizes the handle before loading and turns anything else into an invalid handle', async () => {
        expect(await getPublicProfilePageData({ data: ' TrAveler ' })).toEqual({ status: 'not_found' });
        await getPublicProfilePageData({ data: '../admin' });
        await getPublicProfilePageData({ data: { username: 'traveler' } });
        expect(mocks.load.mock.calls.map(call => call[0])).toEqual(['traveler', null, null]);
    });

    it('treats a malformed payload as unavailable rather than not found', () => {
        expect(parsePublicProfilePageData('{"status":"found"')).toEqual({ status: 'unavailable' });
        expect(parsePublicProfilePageData('{"status":"admin"}')).toEqual({ status: 'unavailable' });
        expect(parsePublicProfilePageData(null)).toEqual({ status: 'unavailable' });
        expect(parsePublicProfilePageData('{"status":"private","preview":{"username":"a"}}')).toMatchObject({ status: 'private' });
    });
});
