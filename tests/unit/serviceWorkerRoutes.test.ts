import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    CACHEABLE_API_PATH,
    isCachingStrategy,
    resolveServiceWorkerStrategy,
    type ServiceWorkerStrategy,
} from '../../shared/serviceWorkerRoutes';

const ORIGIN = 'https://travelflowapp.netlify.app';

const strategyFor = (
    url: string,
    overrides: { method?: string; mode?: string } = {}
): ServiceWorkerStrategy => resolveServiceWorkerStrategy({
    url,
    method: overrides.method ?? 'GET',
    mode: overrides.mode,
    workerOrigin: ORIGIN,
});

describe('resolveServiceWorkerStrategy', () => {
    it('treats document loads as navigations', () => {
        expect(strategyFor(`${ORIGIN}/trips`, { mode: 'navigate' })).toBe('navigation');
        expect(strategyFor(`${ORIGIN}/trip/abc-123`, { mode: 'navigate' })).toBe('navigation');
        expect(strategyFor(`${ORIGIN}/de/trips`, { mode: 'navigate' })).toBe('navigation');
    });

    it('serves the shell files from the precache', () => {
        expect(strategyFor(`${ORIGIN}/spa.html`)).toBe('precache');
        expect(strategyFor(`${ORIGIN}/manifest.webmanifest`)).toBe('precache');
        expect(strategyFor(`${ORIGIN}/brand-plane.svg`)).toBe('precache');
    });

    it('caches hashed build output', () => {
        expect(strategyFor(`${ORIGIN}/assets/index-a1b2c3.js`)).toBe('immutable-asset');
        expect(strategyFor(`${ORIGIN}/assets/index-a1b2c3.css`)).toBe('immutable-asset');
        expect(strategyFor(`${ORIGIN}/assets/chunk-d4e5.mjs`)).toBe('immutable-asset');
    });

    it('does not treat non-code assets as immutable build output', () => {
        // Source maps and JSON data under /assets are not part of the boot path
        // and must not silently fill the asset cache.
        expect(strategyFor(`${ORIGIN}/assets/index-a1b2c3.js.map`)).toBe('network-only');
        expect(strategyFor(`${ORIGIN}/assets/data-9f8e.json`)).toBe('network-only');
    });

    it('caches static media', () => {
        expect(strategyFor(`${ORIGIN}/fonts/space-grotesk/space-grotesk-latin.woff2`)).toBe('static-media');
        expect(strategyFor(`${ORIGIN}/flags/de.svg`)).toBe('static-media');
        expect(strategyFor(`${ORIGIN}/icons/icon-192.png`)).toBe('static-media');
        expect(strategyFor(`${ORIGIN}/images/blog/post.webp`)).toBe('static-media');
        expect(strategyFor(`${ORIGIN}/favicon-32.png`)).toBe('static-media');
        expect(strategyFor(`${ORIGIN}/favicon.ico`)).toBe('static-media');
        expect(strategyFor(`${ORIGIN}/apple-touch-icon.png`)).toBe('static-media');
    });

    it('caches trip map previews and nothing else under /api', () => {
        expect(strategyFor(`${ORIGIN}${CACHEABLE_API_PATH}?coords=1,2`)).toBe('map-preview');
    });

    it.each([
        '/api/health',
        '/api/destinations/taiwan',
        '/api/recommendations?country=TW',
        '/api/ai/generate',
        '/api/billing/paddle/checkout',
        '/api/trip-share-resolve?trip=abc',
        '/api/og/trip',
    ])('never caches %s', (apiPath) => {
        const strategy = strategyFor(`${ORIGIN}${apiPath}`);
        expect(strategy).toBe('network-only');
        expect(isCachingStrategy(strategy)).toBe(false);
    });

    it('leaves cross-origin requests entirely alone', () => {
        expect(strategyFor('https://abc.supabase.co/rest/v1/trips')).toBe('passthrough');
        expect(strategyFor('https://maps.googleapis.com/maps/api/js')).toBe('passthrough');
        expect(strategyFor('https://api.mapbox.com/styles/v1/x')).toBe('passthrough');
        expect(strategyFor('https://analytics.example.com/script.js')).toBe('passthrough');
    });

    it('passes non-GET requests through untouched', () => {
        for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
            expect(strategyFor(`${ORIGIN}/assets/index-a1b2c3.js`, { method })).toBe('passthrough');
            expect(strategyFor(`${ORIGIN}/trips`, { method, mode: 'navigate' })).toBe('passthrough');
        }
    });

    it('passes through unparseable URLs instead of throwing', () => {
        expect(strategyFor('not a url')).toBe('passthrough');
    });
});

/**
 * `scripts/templates/sw.js` ships as plain JavaScript and carries its own copy
 * of the decision table. This extracts the marked block and runs the same
 * assertions against it, so the two implementations cannot drift apart.
 */
describe('service worker template mirrors the shared strategy table', () => {
    const template = fs.readFileSync(
        path.resolve(process.cwd(), 'scripts', 'templates', 'sw.js'),
        'utf8'
    );

    const extractStrategyBlock = (): string => {
        const begin = template.indexOf('/* --- strategy:begin');
        const end = template.indexOf('/* --- strategy:end');
        expect(begin).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(begin);
        return template.slice(begin, end);
    };

    const templateResolve = new Function(
        `${extractStrategyBlock()}\nreturn resolveServiceWorkerStrategy;`
    )() as (facts: {
        url: string;
        method: string;
        mode?: string;
        workerOrigin: string;
    }) => ServiceWorkerStrategy;

    const CASES: Array<{ url: string; method?: string; mode?: string }> = [
        { url: `${ORIGIN}/trips`, mode: 'navigate' },
        { url: `${ORIGIN}/spa.html` },
        { url: `${ORIGIN}/manifest.webmanifest` },
        { url: `${ORIGIN}/brand-plane.svg` },
        { url: `${ORIGIN}/assets/index-a1b2c3.js` },
        { url: `${ORIGIN}/assets/index-a1b2c3.css` },
        { url: `${ORIGIN}/assets/index-a1b2c3.js.map` },
        { url: `${ORIGIN}/fonts/x.woff2` },
        { url: `${ORIGIN}/flags/de.svg` },
        { url: `${ORIGIN}/favicon-16.png` },
        { url: `${ORIGIN}/apple-touch-icon.png` },
        { url: `${ORIGIN}/api/trip-map-preview?coords=1,2` },
        { url: `${ORIGIN}/api/health` },
        { url: `${ORIGIN}/api/ai/generate`, method: 'POST' },
        { url: 'https://abc.supabase.co/rest/v1/trips' },
        { url: 'not a url' },
    ];

    it.each(CASES)('agrees on $url', ({ url, method, mode }) => {
        const facts = { url, method: method ?? 'GET', mode, workerOrigin: ORIGIN };
        expect(templateResolve(facts)).toBe(resolveServiceWorkerStrategy(facts));
    });
});
