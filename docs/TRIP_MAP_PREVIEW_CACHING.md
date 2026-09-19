# Trip Map Preview Caching

How the map image on a trip card is produced, why it is cached the way it is, and
what will quietly start costing money if that is changed.

Endpoint: `netlify/edge-functions/trip-map-preview.ts` (`/api/trip-map-preview`).
Client URL builders: `components/profile/tripPreviewUtils.ts`
(`buildMiniMapUrl` for the current state, `buildSettledMiniMapUrl` for what a
card shows).
Settle rule: `services/tripMapPreviewSettleService.ts`.

## Read this first

Four invariants hold this together. Each one has a cost attached to breaking
it, and each was broken at some point before this document existed.

1. **The endpoint returns image bytes, never a redirect on success.** A
   redirect moves the image to the provider's origin where our CDN cannot
   cache it — one billed render per visitor instead of one per trip state.
2. **The preview URL is the cache key.** Every parameter in it must change the
   picture; a parameter with N values multiplies renders by N.
3. **Cards call `buildSettledMiniMapUrl`, not `buildMiniMapUrl`.** The settled
   one throttles a trip being edited; the raw one renders every state.
4. **Every upstream call is bounded.** A slow third party held open at the
   edge has taken this site down before.

If a change trips one of these, the symptom is a bill or an outage, not a
failing test. The tests named at the end of this document encode all four.

## The model

A preview URL is a **content address**. Every input that changes the picture —
the city coordinates, the per-leg transport modes, the colours, the style, the
size, the active map provider — is a query parameter, and nothing else is. The
response is therefore a pure function of the URL, which is what makes the whole
thing cacheable:

- The same trip, unchanged, is one render, shared by every viewer.
- Move a city, recolour a stop, add a flight leg, and the URL changes, so the
  next request renders once more and that render is then shared in turn.

There is no invalidation step and no stored file to sweep. "Regenerate on a
meaningful change" is a property of the URL, not a job someone has to run.

The cost of that property is that a trip being actively edited produces a new
picture per state. The settle window below is what keeps a burst of edits from
becoming a burst of renders.

## The settle window

A card does not follow its trip immediately. `buildSettledMiniMapUrl` (in
`components/profile/tripPreviewUtils.ts`, over
`services/tripMapPreviewSettleService.ts`) keeps showing the preview this
device already knows for a trip until the trip has been **unchanged for
`TRIP_MAP_PREVIEW_SETTLE_MS` (5 minutes)**, then adopts the new one.

```
trip edited ──▶ URL changes ──▶ card still shows the picture it knows
                                         │
                       trip quiet for 5 minutes
                                         │
                                         ▼
                            next render adopts the new URL
```

Without it, moving three cities and recolouring two of them, with a glance at
the trips list in between each, is five renders and up to forty Directions
calls. With it, those five states collapse into the one the trip landed on.

| Situation | What the card shows |
| --- | --- |
| Trip never seen on this device | The current state. There is no older picture to hold, and somebody has to render it. |
| Trip unchanged | The same URL as last time — the CDN-hit path. |
| Trip edited less than 5 minutes ago | The previously adopted picture (`isHeldBack: true`). |
| Trip quiet for 5 minutes or more | The new picture, which becomes the adopted one. |
| Trip last edited long before this device looked | The new picture immediately — it has already settled. |

**What this costs.** For up to five minutes after an edit, a trip card's
thumbnail can be one state behind. The trip's own map is live and unaffected;
this is the card image only. That trade is the point of the feature — do not
"fix" the staleness by removing the window without replacing the throttle.

Notes for anyone changing this:

- The record lives in `localStorage` under `tf_trip_map_preview_settle_v1`
  (registered in `lib/legal/cookies.config.ts`, capped at 200 trips, evicted by
  least-recently-seen). It is per device on purpose: holding a preview back
  requires knowing the previous one, and only a viewer who has already seen the
  trip knows it.
- Every storage access is wrapped; blocked or full storage degrades to "no
  memory", which renders the current state rather than failing the card.
- The decision is made during render inside a `useMemo`, not in an effect.
  A card that stays mounted past the window keeps the held-back picture until
  it next renders; adding a timer to flip it mid-view would buy a five-minute
  cosmetic refresh for an effect this repo would rather not have.
- Admin surfaces (`pages/AdminTripsPage.tsx`) deliberately call the unsettled
  `buildMiniMapUrl`. Someone inspecting a trip needs its current state.
- The clock and the window are injectable (`now`, `settleMs`), so the rule is
  testable without waiting — see `tests/unit/tripMapPreviewSettle.test.ts`.

## The request path

```
<img src="/api/trip-map-preview?coords=…">
        │
        ▼
Netlify CDN  ── hit ──▶ cached WebP, no provider call, no render cost
        │
        └─ miss ─▶ trip-map-preview.ts
                     ├─ up to 8 Directions calls (routeMode=realistic only)
                     ├─ fetch the static render from Mapbox or Google
                     └─ return the bytes with a durable cache header
```

Cache headers on a successful render (`SUCCESS_CACHE_HEADERS`):

| Header | Value | Why |
| --- | --- | --- |
| `Cache-Control` | `public, max-age=86400, stale-while-revalidate=604800` | The browser keeps the card image for a day and reuses a stale copy for a week while it refreshes. |
| `Netlify-CDN-Cache-Control` | `public, durable, s-maxage=2592000, stale-while-revalidate=31536000` | `durable` survives deploys. A month fresh, then served stale while it re-renders in the background — a visitor never waits for a render they did not have to. |
| `Netlify-Vary` | `query=<allowlist>` | The cache key is the allowlisted parameters in `trip-map-preview-guard.ts`, so a tracking parameter or a different parameter order cannot fragment or bust the cache. |

## What this replaced, and why

Until this change the endpoint answered `302` with a `Location` on
`api.mapbox.com`, and the browser fetched the image from there. Measured against
production on 2026-09-18, one trip card cost:

- a **billed Mapbox Static Images render for every visitor** whose browser cache
  was cold — the bytes never passed through our CDN, so nothing was shared
  between two people looking at the same trip;
- **up to 8 billed Directions calls per preview**, on every edge invocation,
  because `buildMiniMapUrl` asks for `routeMode=realistic`. A profile page with
  a dozen cards could fan out to ~100 Directions calls in one paint;
- **256 KB of PNG** per card and a redirect round trip: ~1.0s for the full
  chain warm, 2.6s on a cold realistic route;
- the Mapbox token published in a `Location` header on every response.

Three of those are gone once the bytes are ours to cache. The fourth is gone on
the success path: the token appears only in the degraded redirect described
below, which is served when the render could not be fetched at all.

## Rules

1. **Never return a redirect to the provider on the success path.** It moves the
   image to an origin our CDN cannot cache, which is the entire bug this
   document exists to prevent. The redirect survives only as the degraded path
   in `proxyPreviewImage`, and it is returned with `Cache-Control: no-store` so a
   bad minute at the provider never becomes a trip's cached picture.
2. **Never add a query parameter that does not change the image.** The URL is
   the cache key; a parameter with N values means N times the renders. The
   Mapbox branch ignores `language` entirely, so `buildMiniMapUrl` omits it
   there — otherwise nine locales bought nine identical renders of every trip.
   New parameters must also be added to `PREVIEW_CACHE_QUERY_PARAMS`, or the CDN
   will serve one variant's image for another's request.
3. **Keep every upstream call bounded.** `DIRECTIONS_TIMEOUT_MS` and
   `UPSTREAM_IMAGE_TIMEOUT_MS` exist because a slow third party held open at the
   edge has taken this site down before
   (`docs/incidents/2026-02-24-edge-timeout-site-outage.md`).
4. **Keep the rate limiter.** The endpoint is unauthenticated by design — it is
   loaded from a plain `<img>` — and a cache miss still spends real money.

## Format

Mapbox renders are requested as WebP (`…/{w}x{h}@2x.webp`), which is roughly 35%
smaller than the PNG it returns by default at the same pixel density: ~146 KB in
place of ~256 KB for a 640x360@2x card. Mapbox Static Images serves only PNG and
WebP — the `.jpg` variants documented for other endpoints 404 here. Google
renders stay PNG; JPEG artefacts are conspicuous on flat map fills and thin
route lines, and the Google branch is not the configured default.

## Service worker

`/api/trip-map-preview` is the one `/api/*` path the service worker may cache
(`shared/serviceWorkerRoutes.ts`), stale-while-revalidate into
`travelflow-map-previews-v1`. That cache only became reachable with this change:
the worker stores a response only when `response.type === 'basic'`, and a
cross-origin redirect followed from a no-cors `<img>` request yields an opaque
response. Same-origin bytes are storable, so previews now survive into the
offline card list.

## Verifying a change here

A CLI alias deploy does not run edge functions, so `/api/*` returns the SPA
shell there (`docs/NETLIFY_FEATURE_BRANCH_DEPLOY.md`). Check a real Deploy
Preview or production:

```bash
curl -s -o /dev/null -D - "https://travelflowapp.netlify.app/api/trip-map-preview?coords=35.68,139.65%7C34.69,135.50&style=standard&routeMode=realistic&colorMode=trip&w=640&h=360&scale=2"
```

Expect `200`, `content-type: image/webp`, no `location` header, and a
`netlify-cdn-cache-control` containing `durable`. Requesting it twice should show
the second response served from the edge cache rather than re-running the
function.

Unit coverage: `tests/unit/tripMapPreviewEdge.test.ts` (proxying, cache headers,
degraded redirect, WebP, rate limiting), `tests/unit/tripPreviewUtils*.test.ts`
(URL construction and the language omission).
