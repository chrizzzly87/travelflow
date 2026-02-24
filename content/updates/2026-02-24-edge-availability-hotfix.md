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
- [ ] [Internal] 🧱 Added build-time static OG asset generation with deterministic hashed filenames plus manifest validation.
- [ ] [Internal] 🛡️ Added explicit safe-route policy enforcement for metadata middleware and kept catch-all edge bindings blocked in CI.
- [ ] [Internal] 🧭 Added static-first OG image lookup with dynamic image fallback and response tracing header (`x-travelflow-og-source`).
- [ ] [Internal] 🌐 Removed external font-CDN fallback dependencies from OG edge image functions and enforced short font-fetch timeouts.
