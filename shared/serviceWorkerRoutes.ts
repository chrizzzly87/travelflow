/**
 * Pure request-routing rules for the offline service worker.
 *
 * The worker itself (`public/sw.js`) is plain JavaScript shipped as-is, so the
 * decision table lives here where it can be unit-tested without a worker
 * runtime. `public/sw.js` keeps an inlined copy of `resolveServiceWorkerStrategy`
 * that must stay in sync; `tests/unit/serviceWorkerRoutes.test.ts` asserts the
 * two agree.
 */

export type ServiceWorkerStrategy =
    | 'passthrough'
    | 'navigation'
    | 'precache'
    | 'immutable-asset'
    | 'static-media'
    | 'map-preview'
    | 'network-only';

export interface ServiceWorkerRequestFacts {
    /** Absolute request URL. */
    url: string;
    /** HTTP method, e.g. `GET`. */
    method: string;
    /** `Request.mode` — `'navigate'` for document loads. */
    mode?: string;
    /** Origin the worker is serving, i.e. `self.location.origin`. */
    workerOrigin: string;
}

/** Same-origin paths served straight from the install-time precache. */
export const PRECACHE_ONLY_PATHS = [
    '/spa.html',
    '/manifest.webmanifest',
    '/brand-plane.svg',
] as const;

const IMMUTABLE_ASSET_EXTENSIONS = ['.js', '.mjs', '.css'];

const STATIC_MEDIA_PREFIXES = ['/fonts/', '/flags/', '/icons/', '/images/'];

/**
 * The only `/api/*` response the worker is allowed to cache.
 *
 * Trip map previews are deterministic images keyed entirely by their query
 * string. Every other API route carries account data or auth state, so caching
 * it would be both a correctness and a privacy hazard — the offline copy of a
 * trip is local storage, never an HTTP cache.
 */
export const CACHEABLE_API_PATH = '/api/trip-map-preview';

export const resolveServiceWorkerStrategy = (
    facts: ServiceWorkerRequestFacts
): ServiceWorkerStrategy => {
    if (facts.method !== 'GET') return 'passthrough';

    let parsed: URL;
    try {
        parsed = new URL(facts.url);
    } catch {
        return 'passthrough';
    }

    // Google Maps, Mapbox, Supabase and Umami are all cross-origin. Leave them
    // entirely alone: intercepting them buys nothing offline and risks breaking
    // their own caching and auth behaviour.
    if (parsed.origin !== facts.workerOrigin) return 'passthrough';

    if (facts.mode === 'navigate') return 'navigation';

    const { pathname } = parsed;

    if (pathname === CACHEABLE_API_PATH) return 'map-preview';
    if (pathname.startsWith('/api/')) return 'network-only';

    if ((PRECACHE_ONLY_PATHS as readonly string[]).includes(pathname)) return 'precache';

    if (
        pathname.startsWith('/assets/')
        && IMMUTABLE_ASSET_EXTENSIONS.some((extension) => pathname.endsWith(extension))
    ) {
        return 'immutable-asset';
    }

    if (STATIC_MEDIA_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return 'static-media';
    }

    if (/^\/favicon(?:-\d+)?\.(?:ico|png|svg)$/.test(pathname)) return 'static-media';
    if (pathname === '/apple-touch-icon.png') return 'static-media';

    return 'network-only';
};

/** Strategies whose responses the worker writes into a cache. */
export const isCachingStrategy = (strategy: ServiceWorkerStrategy): boolean => (
    strategy === 'precache'
    || strategy === 'immutable-asset'
    || strategy === 'static-media'
    || strategy === 'map-preview'
    || strategy === 'navigation'
);
