# PR #591 versus #574 deploy previews (2026-10-24)

Lighthouse 12.8.2, mobile defaults, three runs per page and target, run from one
workstation against `deploy-preview-574` (integration head) and `deploy-preview-591`
(this PR). Raw samples: [preview-lighthouse-raw.txt](preview-lighthouse-raw.txt).

## What the samples support

- **Server response on public pages that are not prerendered improved.** `/inspirations/countries`:
  574 answered in 618–1,870 ms (`cache-control: no-store`, a function run per request);
  591 answered in 102–364 ms once Netlify's durable CDN cache held the document
  (`cache-status: "Netlify Durable"; stored`). `/de/imprint` moved from 417–967 ms to
  289–353 ms. Prerendered pages (`/`) were already static and did not change.
- **Homepage and example-trip scores are unchanged within noise.** Homepage medians:
  82/3.77 s (574) and 83/3.76 s (591). Example trip medians: 61/11.9 s and 59/12.0 s.

## What they do not support

- **LCP on preview hosts is bimodal (about 3.3 s or about 7–8 s) on both targets.** Every slow
  run's LCP element is text with 6.8–7.2 s of render delay. That delay coincides with
  Netlify's collaborative deploy-preview toolbar loading its own scripts, fonts and
  three videos (`/cdp/…`), which production does not serve. Blocking those URLs in
  Lighthouse was not reliably applied. Treat preview LCP as unusable for before/after
  claims; compare production or a local built-site run instead.
- **The example trip's 12 s LCP is not the planner.** Its LCP element is Google Maps'
  "problem with your API key" panel: the referrer-restricted browser key rejects preview
  hosts, and the panel paints late. The same thing happens on both targets. The real trip
  costs on this sample are FCP 2.4 s, TBT 71 ms, and 168 script requests (about 1.1 MB
  transferred, including about 90 KB of unused TripView code). Request count and unused
  TripView code are the measurable #561 follow-ups; verify them on production or a local
  built site, where the map key works.

# Trip view initial JavaScript, local built site (2026-10-24)

Follow-up to the preview finding above, measured locally where the map key works.
Baseline is `origin/claude/tanstack-start-finish`; the change is commit `aad3e724`.
Three Playwright runs per page and revision (Chromium, 1280×900, cache disabled) plus
three Lighthouse 12.8.2 mobile runs of the example trip. Raw samples and settings:
[trip-view-js-raw.txt](trip-view-js-raw.txt).

## What the trip view loaded that only an interaction needs

Source-map attribution of the 540 KB (raw) TripView chunk showed two interaction-only
owners in the first render:

- **zod and the Trip Agent schemas (~78 KB raw).** TripView imported one plain helper,
  `buildTripAgentContextRefs`, from `shared/tripAgent.ts`, whose module scope builds the
  agent's zod schemas. The helper now lives in the zod-free `shared/tripAgentContextRefs.ts`
  (still re-exported from `shared/tripAgent.ts`); zod now loads with the lazy agent chat
  session, which validates proposals.
- **The map customize panel (~18 KB raw with its segmented control).** `MapCustomizeModal`
  rendered `null` (desktop) or a closed drawer (mobile) on every trip. It now loads on its
  first open, like the other trip dialogs, and stays mounted afterwards, so its tab and
  drawer state behave as before.

`tests/unit/tripViewerModuleOwnership.test.ts` fails if TripView statically reaches either
module again.

## Results (identical in every run unless a range is given)

| | baseline | after | change |
| --- | --- | --- | --- |
| TripView chunk, transferred (gzip) | 159.2 KB | 131.6 KB | −17% |
| App script requests (`/assets/`), example / trip | 149 / 148 | 147 / 146 | −2 |
| App JavaScript transferred, example | 1,187.0 KB | 1,155.8 KB | −31.2 KB |
| App JavaScript decoded, example | 3,884.9 KB | 3,776.4 KB | −108.5 KB |
| Unexecuted decoded JS after load (V8 coverage), example | 2,599 KB | 2,529 KB | −70 KB |
| Lighthouse unused TripView estimate | 94.5 KB | 78.4 KB | −16.1 KB |
| Lighthouse TBT (3 runs) | 59 / 65 / 187 ms | 38 / 40 / 165 ms | within noise |
| Lighthouse LCP (3 runs) | 5.41–5.59 s | 5.41–5.61 s | unchanged |

The `/trip/<encoded>` fixture moves identically (148 → 146 requests, 1,186.8 → 1,155.6 KB).
Total script counts (160–168) also include a varying number of Google Maps scripts.

## What these samples do not show

- No readiness or LCP improvement: LCP is unchanged and time-to-trip-header is bimodal on
  both revisions. The win is less JavaScript to download, parse and compile.
- **Request count is not driven by the trip view.** About 100 of ~160 script requests
  are chunks under 2 KB (one per shared icon or small helper) emitted by rolldown's
  automatic chunking. Changing that means global chunking options, which this document's
  architecture rules reserve for a measured, separate decision.
- **Remaining large candidates were left alone on purpose.** framer-motion and motion-dom
  (~120 KB raw) belong to `TripFloatingMapPreview`, which hosts the map in docked and
  floating mode, so loading its features asynchronously would move the map frame before
  they arrive. `mapbox-gl` (~449 KB transferred) and Google Maps are the map runtime
  itself. `TripTimelineListView` is a persisted view mode, so splitting it would add a
  loading state for list-view users.
