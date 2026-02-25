---
id: rel-2026-02-25-site-og-build-reliability-hotfix
version: v0.64.0
title: "Site OG build reliability hotfix"
date: 2026-02-25
published_at: 2026-02-25T14:35:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Production builds now use a more resilient static OG rendering pass to reduce deployment failures while preserving route-level previews."
---

## Changes
- [x] [Fixed] 🛠️ Social preview generation is now more resilient during production deploys, reducing the chance of failed releases caused by transient rendering errors.
- [ ] [Internal] 🧱 Added retry + safe fallback rendering in the static OG Deno batch pass and lowered default renderer concurrency for steadier CI performance.
