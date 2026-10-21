/**
 * TravelFlow offline service worker (template).
 *
 * This file is NOT served as-is. `scripts/build-service-worker.mjs` runs after
 * prerendering, replaces __BUILD_HASH__ and __PRECACHE_MANIFEST__ with values
 * derived from the real build output, and writes the result to `dist/sw.js`.
 * Keeping the template out of `public/` means a build that skips the generator
 * publishes no service worker at all, rather than a broken one.
 *
 * The routing table below mirrors `shared/serviceWorkerRoutes.ts`, which is the
 * documented source of truth. `tests/unit/serviceWorkerRoutes.test.ts` extracts
 * the marked block from this file and asserts the two agree, so they cannot
 * drift silently.
 */

const BUILD_HASH = '__BUILD_HASH__';
const PRECACHE_MANIFEST = __PRECACHE_MANIFEST__;

const SHELL_CACHE = 'travelflow-shell-' + BUILD_HASH;
const ASSET_CACHE = 'travelflow-assets-' + BUILD_HASH;
const MEDIA_CACHE = 'travelflow-media-v1';
const MAP_PREVIEW_CACHE = 'travelflow-map-previews-v1';

const NAVIGATION_FALLBACK = '/spa.html';
const NAVIGATION_TIMEOUT_MS = 3000;
const MEDIA_CACHE_MAX_ENTRIES = 200;
const MAP_PREVIEW_CACHE_MAX_ENTRIES = 60;

/* --- strategy:begin (mirrored from shared/serviceWorkerRoutes.ts) --- */
const PRECACHE_ONLY_PATHS = ['/spa.html', '/manifest.webmanifest', '/brand-plane.svg'];
const IMMUTABLE_ASSET_EXTENSIONS = ['.js', '.mjs', '.css'];
const STATIC_MEDIA_PREFIXES = ['/fonts/', '/flags/', '/icons/', '/images/'];
const CACHEABLE_API_PATH = '/api/trip-map-preview';

function resolveServiceWorkerStrategy(facts) {
  if (facts.method !== 'GET') return 'passthrough';

  let parsed;
  try {
    parsed = new URL(facts.url);
  } catch (error) {
    return 'passthrough';
  }

  if (parsed.origin !== facts.workerOrigin) return 'passthrough';
  if (facts.mode === 'navigate') return 'navigation';

  const pathname = parsed.pathname;

  if (pathname === CACHEABLE_API_PATH) return 'map-preview';
  if (pathname.indexOf('/api/') === 0) return 'network-only';
  if (PRECACHE_ONLY_PATHS.indexOf(pathname) !== -1) return 'precache';

  if (
    pathname.indexOf('/assets/') === 0
    && IMMUTABLE_ASSET_EXTENSIONS.some(function (extension) { return pathname.endsWith(extension); })
  ) {
    return 'immutable-asset';
  }

  if (STATIC_MEDIA_PREFIXES.some(function (prefix) { return pathname.indexOf(prefix) === 0; })) {
    return 'static-media';
  }

  if (/^\/favicon(?:-\d+)?\.(?:ico|png|svg)$/.test(pathname)) return 'static-media';
  if (pathname === '/apple-touch-icon.png') return 'static-media';

  return 'network-only';
}
/* --- strategy:end --- */

const isOwnCache = (name) => (
  name === SHELL_CACHE
  || name === ASSET_CACHE
  || name === MEDIA_CACHE
  || name === MAP_PREVIEW_CACHE
);

const isTravelFlowCache = (name) => name.indexOf('travelflow-') === 0;

/**
 * Trim a cache to `maxEntries`, dropping the oldest insertions first.
 * `cache.keys()` returns entries in insertion order, which is the closest thing
 * the Cache API offers to an LRU without tracking access times ourselves.
 */
const trimCache = async (cacheName, maxEntries) => {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const excess = keys.length - maxEntries;
  for (let index = 0; index < excess; index += 1) {
    await cache.delete(keys[index]);
  }
};

const isStorableResponse = (response) => Boolean(
  response && response.ok && response.type === 'basic'
);

const cacheFirst = async (request, cacheName, maxEntries) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isStorableResponse(response)) {
    await cache.put(request, response.clone());
    if (maxEntries) await trimCache(cacheName, maxEntries);
  }
  return response;
};

const staleWhileRevalidate = async (request, cacheName, maxEntries, event) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const refresh = fetch(request)
    .then(async (response) => {
      if (isStorableResponse(response)) {
        await cache.put(request, response.clone());
        await trimCache(cacheName, maxEntries);
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    // The cached preview renders now; the fresh one lands for next time.
    event.waitUntil(refresh);
    return cached;
  }

  const response = await refresh;
  if (response) return response;
  // Offline with nothing cached: a 504 lets the <img> fall back to its normal
  // broken-image handling instead of surfacing a worker exception.
  return new Response('', { status: 504, statusText: 'Offline' });
};

/**
 * Network-first with a timeout, falling back to the precached shell.
 *
 * The timeout matters more than the plain offline case: iOS frequently reports
 * itself online on a captive or dead Wi-Fi network, where the request neither
 * fails nor completes. Without the race, launching the app there would hang
 * instead of showing the cached trip list.
 */
const navigationWithShellFallback = async (request) => {
  const shellCache = await caches.open(SHELL_CACHE);

  const networkAttempt = fetch(request)
    .then(async (response) => {
      if (isStorableResponse(response)) {
        await shellCache.put(NAVIGATION_FALLBACK, response.clone());
      }
      return response;
    });
  // The race below can leave this promise unhandled on the timeout path.
  networkAttempt.catch(() => null);

  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(null), NAVIGATION_TIMEOUT_MS);
  });

  try {
    const response = await Promise.race([networkAttempt, timeout]);
    if (response) return response;
  } catch (error) {
    // Fall through to the cached shell.
  }

  const cachedShell = await shellCache.match(NAVIGATION_FALLBACK);
  if (cachedShell) return cachedShell;

  // Nothing cached and nothing reachable: let the network attempt settle so the
  // browser shows its own error page rather than an opaque worker failure.
  return networkAttempt;
};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // `cache.addAll` is atomic: one 404 rejects the whole install, this worker
    // never activates, and the previous one stays in charge. That is what we
    // want — a half-populated shell is worse than none.
    await cache.addAll(PRECACHE_MANIFEST);

    // Take over immediately only on a first install, when there is no existing
    // worker and so no live session whose bundle could be swapped mid-edit.
    // An update waits for the next cold start.
    const existingClients = await self.clients.matchAll();
    if (existingClients.length === 0) {
      await self.skipWaiting();
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => isTravelFlowCache(name) && !isOwnCache(name))
        .map((name) => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  // Support escape hatch: lets the page promote a waiting worker on demand.
  if (event.data && event.data.type === 'TF_SKIP_WAITING') {
    void self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const strategy = resolveServiceWorkerStrategy({
    url: event.request.url,
    method: event.request.method,
    mode: event.request.mode,
    workerOrigin: self.location.origin,
  });

  switch (strategy) {
    case 'navigation':
      event.respondWith(navigationWithShellFallback(event.request));
      return;
    case 'precache':
      event.respondWith(cacheFirst(event.request, SHELL_CACHE));
      return;
    case 'immutable-asset':
      event.respondWith(cacheFirst(event.request, ASSET_CACHE));
      return;
    case 'static-media':
      event.respondWith(cacheFirst(event.request, MEDIA_CACHE, MEDIA_CACHE_MAX_ENTRIES));
      return;
    case 'map-preview':
      event.respondWith(
        staleWhileRevalidate(event.request, MAP_PREVIEW_CACHE, MAP_PREVIEW_CACHE_MAX_ENTRIES, event)
      );
      return;
    default:
      // 'passthrough' and 'network-only' are left to the browser entirely.
  }
});
