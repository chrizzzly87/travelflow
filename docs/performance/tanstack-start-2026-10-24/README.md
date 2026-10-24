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
- **The example trip's 12 s LCP is the full planner render on a throttled mobile CPU.**
  It is the same on both targets and remains #561 territory (TripView decomposition).
