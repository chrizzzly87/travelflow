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
- [x] [Fixed] 🌐 Pre-generated social previews now consistently render the canonical public domain in the footer instead of local build host addresses.
- [x] [Improved] ⚡ Static social preview generation now focuses on high-impact pages first, cutting production build workload while keeping dynamic fallback previews for all other routes.
- [ ] [Internal] 🧱 Added retry + safe fallback rendering in the static OG Deno batch pass and tuned default renderer concurrency for faster, steadier CI execution.
- [ ] [Internal] 📋 Added full-scope override commands (`pnpm og:site:build:full` + `pnpm og:site:validate:full`) plus updated admin/docs guidance so teams can intentionally widen pre-generation coverage when needed.
