# Offline trips and installable PWA (iOS)

- Status: draft, awaiting review
- Date: 2026-09-18
- Branch: `claude/offline-trips-pwa-iphone-a80416`

## Goal

Let a traveller install TravelFlow on an iPhone home screen and open their saved
trips with no network. Read-only viewing offline is the requirement; editing
offline is a bonus that the existing sync queue already provides.

## Problem

TravelFlow already stores trips locally and already resolves them from local
storage when connectivity is `offline`:

| Capability | Where | State |
| --- | --- | --- |
| Trips persisted locally | `services/storageService.ts` (`travelflow_trips_v1`) | exists |
| All DB trips mirrored locally on sync | `services/dbService.ts` (`syncTripsFromDb`) | exists |
| Trip resolves from cache when offline | `routes/TripLoaderRoute.tsx` | exists |
| Offline edit queue + sync on reconnect | `services/offlineChangeQueue.ts`, `services/tripSyncManager.ts` | exists |
| Offline UI affordances | `components/GlobalConnectivityBadge.tsx`, `components/ConnectivityStatusBanner.tsx` | exists |
| App shell loads without network | — | **missing** |
| Installable web app manifest | — | **missing** |

The offline features are built but unreachable: with no service worker, Safari
cannot fetch `index.html`, the JS bundles or the CSS, so the app never boots and
none of the above runs. This work supplies the missing shell layer.

## Non-goals

- Live map tiles offline (Google Maps / Mapbox need the network).
- Place photos and AI generation offline.
- Marketing pages, blog and inspirations offline.
- Any new sync, merge or conflict-resolution machinery.
- Android / desktop install polish beyond what the same manifest gives for free.

## Approach

A hand-written service worker plus a post-build precache generator, rather than
`vite-plugin-pwa`.

The build is `vite build && node scripts/prerender-routes.mjs`. Prerendering runs
**after** vite and writes `dist/spa.html` plus every prerendered
`<route>/index.html`. A Workbox manifest generated during `vite build` would miss
exactly the HTML the offline shell depends on. A generator that runs last sees
the final `dist/`, needs no new dependency, and keeps the caching rules readable
in one reviewable file.

## Components

Each unit below is independently testable and has one job.

### 1. `public/manifest.webmanifest`

Static file. Declares `name`, `short_name`, `display: standalone`,
`start_url: "/trips?source=pwa"`, `scope: "/"`, `theme_color: "#4f46e5"`,
`background_color: "#ffffff"`, and icons at 192px, 512px and 512px `maskable`.

`index.html` gains `<link rel="manifest">`, `apple-mobile-web-app-capable` and
`apple-mobile-web-app-status-bar-style` (the latter two for iOS below 16.4,
which ignores the manifest for home-screen behaviour).

### 2. Icon generation

Extend the existing image build (`scripts/build-image-placeholders.ts` sits in
the same phase) with a step that renders `public/brand-plane.svg` on the brand
indigo background to `public/icons/icon-192.png`, `icon-512.png` and
`icon-512-maskable.png` via `sharp` (already a devDependency). Maskable variant
keeps the plane inside the 80% safe zone.

### 3. `scripts/build-service-worker.mjs`

Runs after `scripts/prerender-routes.mjs` in both `build` and `build:netlify`.

- Parses `dist/spa.html` for its entry `<script type="module">` and stylesheet
  links, and combines them with a small fixed list: `/spa.html`,
  `/manifest.webmanifest`, `/brand-plane.svg`, `/icons/*`, the favicons, and the
  two default Latin font files that `index.html` already preloads.
- Computes one short build hash over the collected file contents.
- Reads `public/sw.js` and replaces the `__PRECACHE_MANIFEST__` and
  `__BUILD_HASH__` placeholders, writing the result to `dist/sw.js`.
- Fails the build loudly if `dist/spa.html` is absent, or if the parsed entry
  script cannot be found on disk, so a pipeline reorder cannot silently ship a
  service worker that cannot serve navigations.

This precache set is deliberately small — roughly the boot shell only. The full
`dist/assets` tree runs to tens of megabytes (three.js, mapbox-gl, shiki) and
`public/flags` alone is 1 MB; precaching it at install time would be a hostile
download on a phone. Everything beyond the shell is captured by the runtime
cache-first rule below, on first use.

The HTML parsing and precache-list assembly live in
`scripts/lib/serviceWorkerManifest.mjs` as pure functions taking HTML text and a
file-content map, so they are unit-testable without touching the filesystem
layout.

### 4. `public/sw.js`

The service worker. Cache name is `travelflow-shell-<BUILD_HASH>`.

| Request | Strategy |
| --- | --- |
| Precached boot shell | Cache-first |
| Navigations (`request.mode === 'navigate'`) | Network-first with a 3s timeout, falling back to precached `/spa.html` |
| `/assets/**` (`.js`, `.css`) | Cache-first, written on first fetch. Filenames are content-hashed and served `immutable`, so a cached entry is never wrong |
| `/fonts/**`, `/flags/**`, `/icons/**`, `/images/**` | Cache-first, LRU-capped at 200 entries |
| `/api/trip-map-preview?*` | Stale-while-revalidate in `travelflow-map-previews`, LRU-capped at 60 entries |
| Everything else under `/api/*`, and all Supabase origins | Network-only, never cached |
| Cross-origin (Google, Mapbox, Umami) | Not intercepted |

**The offline contract this produces:** a route works offline once it has been
opened online at least once on that device. The boot shell is guaranteed by the
precache; each route's lazy chunks are captured by the cache-first rule the
first time they load. This matches the real use — install, browse trips, then
fly. `/trips` and `/trip/:id` are additionally warmed on first launch by the
existing route-prefetch machinery (`app/prefetch/`), so the common path is
covered without the user having to think about it.

`install` precaches and calls `skipWaiting()` **only** when no other client is
controlled; otherwise the new worker waits. `activate` deletes every cache whose
name does not match the current build hash, then `clients.claim()`.

Non-GET requests are passed straight through.

Route-matching is factored into `shared/serviceWorkerRoutes.ts` — pure functions
taking a URL and returning a strategy name — imported by both the worker and the
unit tests.

### 5. `services/serviceWorkerRegistration.ts`

Registers `/sw.js` after first paint (on `load`, behind an idle callback) so it
never competes with the boot shell for bandwidth. No-ops when
`navigator.serviceWorker` is absent, when running under Vite dev, and under
Playwright's e2e sandbox unless explicitly enabled. Exposes
`unregisterServiceWorker()` as an escape hatch for support.

An updated worker is **not** activated mid-session; it takes effect on the next
cold start. Swapping bundles under a live editing session risks losing unsaved
trip edits.

### 6. `/trips` route

`components/TripManager.tsx` gains a `variant?: 'overlay' | 'page'` prop. In
`page` mode it renders without the backdrop, without the focus trap and without
the close button, filling the route. The overlay path is unchanged — it keeps
`role="dialog"`, `aria-modal`, focus trap, Escape and mobile backdrop, per the
project's overlay contract.

A new `routes/TripsRoute.tsx` mounts it at `/trips` (and the localized
`/{locale}/trips` variants, per `docs/I18N_PAGE_WORKFLOW.md`). Selecting a trip
navigates to `/trip/:id` exactly as the overlay does today.

The page also surfaces the pending-sync count from `useSyncStatus()` so queued
offline edits are visible.

`/trips` is added to the prerender route list and to `sitemap.xml` generation.

## Data flow

Online:

```
open app -> SW serves precached shell -> React boots ->
useDbSync -> syncTripsFromDb -> writes every trip to localStorage
```

Offline cold start:

```
tap home-screen icon -> iOS requests /trips?source=pwa ->
SW navigation handler: network fails -> serves cached /spa.html ->
React boots from precached /assets/* -> TripsRoute reads getAllTrips()
-> tap a trip -> /trip/:id -> TripLoaderRoute sees connectivity 'offline'
-> getTripById() -> renders read-only
```

Offline edit:

```
edit -> enqueueTripCommitAndSync -> offlineChangeQueue (localStorage)
-> reconnect -> tripSyncManager drains queue -> conflict backups on divergence
```

Nothing in the sync path changes.

## Error handling

- **Service worker registration fails**: swallowed and logged at debug level.
  The app behaves exactly as it does today. Offline support degrades; nothing
  breaks.
- **Precache fails during install**: the `install` event rejects, the worker is
  discarded, and the previous worker (if any) stays in control. A partially
  populated cache is never activated.
- **Cached shell is stale relative to deployed assets**: the build hash changes
  on every deploy, so the new worker precaches a fresh set and the old cache is
  deleted on activate. Hashed `/assets/*` filenames mean the old and new sets
  never collide.
- **`localStorage` full**: `storageService` already prunes oldest trips and
  emits `TRIPS_PRUNED_EVENT`. Unchanged. Documented as a best-effort limit.
- **Trip not in local storage while offline**: `TripLoaderRoute` finds nothing;
  the existing offline banner explains it. `/trips` only lists what is cached,
  so the user cannot navigate into this state from the start page.
- **No raw exceptions reach the user.** Offline states use the existing
  `ConnectivityStatusBanner` copy.

## Testing

Unit (Vitest):

- `shared/serviceWorkerRoutes.ts` — every row of the strategy table, including
  that Supabase and `/api/*` (other than `trip-map-preview`) resolve to
  network-only, and that non-GET is passed through.
- `scripts/lib/serviceWorkerManifest.mjs` — entry script and stylesheet
  extraction from shell HTML, hash stability for identical input, hash change on
  content change, and a thrown error when no entry script is found.
- `services/serviceWorkerRegistration.ts` — no-ops without
  `navigator.serviceWorker`; does not throw when `register` rejects.
- `TripManager` in `variant="page"` — renders without dialog semantics; the
  overlay variant still exposes `role="dialog"` and `aria-modal`.

E2E (Playwright):

- Load the app online, visit `/trips` and a trip so their chunks are cached,
  wait for the worker to control the page, then `context.setOffline(true)`,
  reload `/trips`, and assert the synced trip is listed and opens read-only.
  This is the regression test for the actual failure mode — the app not booting
  at all offline.

Manual (documented in the runbook, not automated):

- Real iPhone: Add to Home Screen, airplane mode, cold launch, open a trip.

## Documentation and release

- New `docs/PWA_OFFLINE.md`: what is cached, what is not, how to force-refresh a
  stuck worker, and the iOS cache-eviction caveat.
- One release note in `content/updates/`, `status: draft` while the PR is open,
  per `docs/UPDATE_FORMAT.md`.
- New user-facing copy (the `/trips` page heading, install hint, pending-sync
  label) needs EN/DE style approval before finalising, per the project's copy
  rule. All new keys land in all nine active locales and pass
  `pnpm i18n:validate`.

## Stated limits

These ship as known behaviour, not defects:

1. Live map tiles and place photos require the network. Only the static
   `/api/trip-map-preview` images are cached, and only those viewed while
   online.
2. `localStorage` is roughly 5 MB. Accounts with many large trips will have the
   oldest pruned; "all trips offline" is best-effort.
3. iOS may evict caches after extended non-use. The first launch after eviction
   needs the network once.
4. A trip never opened or synced on the device is not available offline.
5. A route never visited online on that device may not open offline, because
   its lazy chunk was never fetched. `/trips` and `/trip/:id` are prefetched on
   first launch to cover the paths that matter here.
