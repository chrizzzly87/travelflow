---
id: rel-2026-02-24-edge-availability-hotfix
version: v0.58.0
title: "Edge availability hotfix"
date: 2026-02-24
published_at: 2026-02-24T18:40:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Stabilizes site availability while restoring targeted OG metadata routing for marketing pages."
---

## Changes
- [x] [Fixed] 🛟 Restored reliable page and asset loading during intermittent edge timeout spikes.
- [x] [Fixed] 🖼️ Restored blog and localized page social previews with targeted metadata routing instead of site-wide interception.
- [x] [Fixed] 🧭 Removed metadata middleware from the homepage and core app entry flow to prevent repeat edge timeout crashes on `/`.
- [ ] [Internal] 🧭 Disabled catch-all site-wide edge interception as an emergency availability mitigation while keeping targeted edge routes active.
- [ ] [Internal] 🧱 Added explicit route allowlists for metadata middleware and blocked future catch-all edge bindings in validation.
- [ ] [Internal] 🛡️ Added site-og-meta scope enforcement and middleware upstream-fallback handling to reduce future edge crash blast radius.
