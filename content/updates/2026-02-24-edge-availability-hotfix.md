---
id: rel-2026-02-24-edge-availability-hotfix
version: v0.58.0
title: "Edge availability hotfix"
date: 2026-02-24
published_at: 2026-02-24T18:40:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Stabilizes edge availability and restores reliable custom social previews across static pages, blog, and example trips."
---

## Changes
- [x] [Fixed] 🛟 Restored reliable page and asset loading during intermittent edge timeout spikes.
- [x] [Fixed] 🖼️ Restored custom social previews for static pages, localized blog entries, and example trip pages.
- [x] [Improved] ⚡ Switched static-page preview images to pre-generated assets for faster, more stable social-card delivery.
- [x] [Fixed] 🧯 Hardened social-image rendering so temporary third-party font-network slowdowns no longer break OG image endpoints.
- [x] [Fixed] 🧭 Updated example template social previews to use the same trip-card style as shared trip previews.
- [x] [Fixed] 🎨 Restored the classic static social-preview visual style (wave panel, proper footer branding, and full page URL in preview cards).
- [ ] [Internal] 🧱 Added build-time static OG asset generation with deterministic hashed filenames plus manifest validation.
- [ ] [Internal] 🛡️ Added explicit safe-route policy enforcement for metadata middleware and kept catch-all edge bindings blocked in CI.
- [ ] [Internal] 🧭 Added static-first OG image lookup with dynamic image fallback and response tracing header (`x-travelflow-og-source`).
- [ ] [Internal] 🌐 Removed external font-CDN fallback dependencies from OG edge image functions and enforced short font-fetch timeouts.
- [ ] [Internal] 🗺️ Routed `/example/*` OG images through trip-style renderer overrides while preserving static-site OG coverage for other marketing paths.
- [ ] [Internal] ♻️ Added Netlify build-cache restore/save for static OG assets so unchanged generated social-preview images can be reused across CI deploys.
- [ ] [Internal] 🧪 Added Netlify secret-scan guardrails for public browser key prefixes used in client-side map integrations, including disabling enhanced smart detection to prevent repeated preview deploy false positives.
- [ ] [Internal] 🛠️ Added `/admin/og-tools` with a same-origin OG inspector showing canonical/OG/Twitter tags plus static-vs-dynamic source detection.
- [ ] [Internal] 🧭 Added filtered static OG command builder support (`--locales`, include/exclude paths/prefixes) with documented release-safe full validation flow.
- [ ] [Internal] ♻️ Versioned the static OG template hash revision and regenerated all locale/static OG assets so stale legacy-style files are fully replaced.
- [ ] [Internal] 🧪 Added OG Tools dual-tab workflow (URL Analyzer + embedded OG Playground) with rendered `og:image` preview inside analyzer results.
- [ ] [Internal] 🩺 Added embedded OG Playground health checks and explicit Trip/Site mode switching so admin tools always expose the full legacy query-control interface.
