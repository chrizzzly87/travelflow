# Instrumented cold-route profile

Source: foundation runtime `b127e152` (documentation-only HEAD `363d233b`). One
instrumented cold context per route, Chromium 145, 4× CPU, 40 ms network latency,
500 KB/s throughput, 1 ms CPU sampling, external network and service workers blocked.
This diagnostic is not a repeatable benchmark median and cannot establish an
improvement. The existing five-run comparison remains the quantitative baseline.

- Pricing: approximately 1,497 ms readiness; its initial application chunk is 131 KB
  gzip and finishes around 975 ms. React DOM accounts for about 89 ms sampled self
  time; the application entry about 41 ms. Auth modules and UI support chunks load
  after the initial route graph. Source review confirms anonymous auth bootstrap
  currently invalidates the entire router, including public root `beforeLoad`.
- Classic creation: destination/country-alias modules contribute about 49/27 ms
  sampled self time and 26/35 KB gzip. The first local dynamic SSR request also pays
  about 1,346 ms response latency from server-module startup; the warmed benchmark
  deliberately discards its server warmup. This is not measured hosted TTFB.
- Example: the TripView chunk is approximately 162 KB gzip, requested around 1,577 ms
  and complete around 2,435 ms; it accounts for about 131 ms sampled self time.
  Destination aliases, generation services and optional modal dependencies remain
  in that graph. Scope optional tools to their owners after checking unique imports.

Chosen immediate work: remove false loading chrome, preserve early control/consent
interaction, fix the independently reproduced auth-bootstrap completion race, and
measure actual homepage Lighthouse results. Session-aware revalidation now uses native route staticData and retires sensitive
caches/preloads without reloading public pages. Deeper optional TripView splitting
remains follow-up work under issue #561; it is not represented as already optimized.

Raw local diagnostic: `perf/runtime/tanstack-route-profile.json` (ignored, sanitized
local asset paths only). Production promotion remains separate from feature previews.
