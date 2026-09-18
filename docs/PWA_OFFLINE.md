# PWA and offline support

TravelFlow installs to a phone home screen and opens saved trips with no
network. This document is the operational reference: what is cached, what is
not, and how to recover a device stuck on a bad build.

## The offline contract

> A route works offline once it has been opened online at least once on that
> device, and a trip opens offline once it has been synced to that device.

That is the honest guarantee. The boot shell is precached at install time; each
route's lazy chunks are cached the first time they load.

## Why this was needed

Almost all of the offline behaviour already existed before this feature:

| Capability | Where |
| --- | --- |
| Trips persisted locally | `services/storageService.ts` (`travelflow_trips_v1`) |
| All account trips mirrored locally on sync | `services/dbService.ts` (`syncTripsFromDb`) |
| Trip resolves from cache when offline | `routes/TripLoaderRoute.tsx` |
| Offline edit queue and sync on reconnect | `services/offlineChangeQueue.ts`, `services/tripSyncManager.ts` |
| Offline banners and badge | `components/ConnectivityStatusBanner.tsx`, `components/GlobalConnectivityBadge.tsx` |

None of it could run, because with no service worker the browser could not fetch
`index.html`, the JavaScript or the CSS. This feature supplies only the missing
shell layer. It adds no sync, merge or conflict machinery.

## Pieces

| File | Role |
| --- | --- |
| `public/manifest.webmanifest` | Install metadata. `start_url` is `/trips?source=pwa` |
| `scripts/build-pwa-icons.ts` | Renders 192/512/maskable icons from `public/brand-plane.svg` |
| `shared/serviceWorkerRoutes.ts` | The request-strategy table, unit-tested |
| `scripts/templates/sw.js` | The worker source, with `__BUILD_HASH__` / `__PRECACHE_MANIFEST__` placeholders |
| `scripts/lib/serviceWorkerManifest.mjs` | Pure precache-list and hash helpers |
| `scripts/build-service-worker.mjs` | Writes `dist/sw.js`; runs **last** in the build |
| `services/serviceWorkerRegistration.ts` | Registers the worker after first paint |
| `routes/TripsRoute.tsx` | The `/trips` start page |

The template lives in `scripts/templates/`, not `public/`, on purpose: a build
that skips the generator then publishes no worker at all rather than a broken
one carrying unsubstituted placeholders.

`scripts/build-service-worker.mjs` must run after `scripts/prerender-routes.mjs`,
because the precache list is derived from `dist/spa.html`, which prerendering
writes after `vite build` has finished. This is why the project does not use
`vite-plugin-pwa`: a Workbox manifest generated during the vite phase cannot see
that file.

## Caching strategies

| Request | Strategy |
| --- | --- |
| Precached boot shell | Cache-first |
| Navigations | Network-first, 3s timeout, falling back to precached `/spa.html` |
| `/assets/**` (`.js`, `.mjs`, `.css`) | Cache-first, written on first fetch |
| `/fonts/**`, `/flags/**`, `/icons/**`, `/images/**` | Cache-first, LRU-capped at 200 |
| `/api/trip-map-preview?*` | Stale-while-revalidate, LRU-capped at 60 |
| Every other `/api/*`, and all Supabase traffic | **Network-only, never cached** |
| Cross-origin (Google, Mapbox, Umami) | Not intercepted |

The navigation timeout matters more than the plain offline case: iOS often
reports itself online on a captive or dead Wi-Fi network, where a request
neither fails nor completes. Without the race, launching the app there would
hang instead of showing the cached trip list.

Account API responses are never cached. The offline copy of a trip is local
storage, which is scoped to the signed-in user by the app; an HTTP cache is not,
so caching those responses would be both a correctness and a privacy hazard.

## Updates

Each build produces a content hash, which names the shell and asset caches.
`activate` deletes every `travelflow-` cache that does not belong to the current
build.

A new worker **does not** take over a live session. It activates on the next
cold start. Swapping the bundle under someone who is mid-edit risks losing
unsaved trip changes. A first install, where there is no existing worker and so
no live session, does call `skipWaiting()` immediately.

## Recovering a stuck device

In order of escalation:

1. Fully close the app or tab and reopen it. A waiting worker activates on a
   cold start.
2. From the browser console: `await (await import('/assets/...')).unregisterServiceWorker()`
   is awkward — instead set the escape hatch and reload:
   `localStorage.setItem('tf_disable_sw', '1')`. That stops registration on the
   next load; it does not remove an already-installed worker.
3. To remove the worker and its caches outright, run in the console:
   ```js
   (await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
   (await caches.keys()).filter(n => n.startsWith('travelflow-')).forEach(n => caches.delete(n));
   ```
   Then hard-reload. `services/serviceWorkerRegistration.ts` exports
   `unregisterServiceWorker()` which does exactly this.
4. On iOS, deleting the home-screen icon and re-adding it clears the app's
   storage entirely.

The worker also responds to a `{ type: 'TF_SKIP_WAITING' }` `postMessage`, which
promotes a waiting worker on demand.

## Testing

- `pnpm test:core` covers the strategy table, the precache generator, the
  registration guard and the `TripManager` page variant.
- `pnpm test:e2e:pwa` runs the offline boot test against a **real production
  build**. Run `pnpm build` (or `pnpm build:netlify`) first — the worker does not
  exist under `vite dev`, where registration deliberately no-ops.

Before releasing a change to the worker, verify manually on a real iPhone:
Add to Home Screen, enable airplane mode, cold launch, open a trip.

## Known limits

These are known behaviour, not defects:

1. Live map tiles and place photos need the network. Only the static
   `/api/trip-map-preview` images are cached, and only those seen while online.
2. `localStorage` is roughly 5 MB, and `storageService` already prunes the
   oldest trips when it fills. "All trips offline" is best-effort.
3. iOS may evict caches after extended non-use. The first launch after eviction
   needs the network once.
4. A trip never opened or synced on the device is not available offline.
5. A route never visited online on that device may not open offline. `/trips`
   and `/trip/:id` are the paths that matter and are warmed on first launch.
