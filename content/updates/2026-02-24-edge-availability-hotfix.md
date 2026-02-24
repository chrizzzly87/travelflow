---
id: rel-2026-02-24-edge-availability-hotfix
version: v0.58.0
title: "Edge availability hotfix"
date: 2026-02-24
published_at: 2026-02-24T18:40:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Stabilizes site availability by disabling global edge interception during upstream timeout incidents."
---

## Changes
- [x] [Fixed] 🛟 Restored reliable page and asset loading during intermittent edge timeout spikes.
- [ ] [Internal] 🧭 Disabled catch-all site-wide edge interception as an emergency availability mitigation while keeping targeted edge routes active.
