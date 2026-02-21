---
id: rel-2026-02-21-vitest-pnpm-regression-layer
version: v0.55.0
title: "PNPM testing baseline and core regression coverage"
date: 2026-02-21
published_at: 2026-02-21T19:45:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Introduces a pnpm-aligned Vitest regression layer for core business logic with deploy-time test gating."
---

## Changes
- [x] [Improved] 🛡️ Trip planning reliability is now protected by an automated core regression test suite before production builds.
- [ ] [Internal] 🧪 Added Vitest coverage for core business logic modules, locale/path utilities, destination resolution, release/blog parsing, and browser-storage service behavior.
- [ ] [Internal] 🚦 Added a build gate so core regression coverage runs before deploy builds.
- [ ] [Internal] 📦 Standardized the project workflow on pnpm commands and lockfile management for local, CI, and deploy paths.
- [ ] [Internal] 📚 Updated agent/LLM guidance to require tests for behavioral changes and regression tests for bug fixes, with docs/copy/style-only exemptions.
- [ ] [Internal] 🔍 Added a PR Quality GitHub Actions workflow that runs `pnpm test:core` and `pnpm build` on every pull request.
- [ ] [Internal] 👥 Added CODEOWNERS review ownership for `tests/**` and `vitest.config.ts` changes.
- [ ] [Internal] ✅ Added a PR template checklist and CI guard requiring `tests/**` checklist entries when new files are introduced in `services/` or `config/`.
- [ ] [Internal] 🧭 Added a phase-2 testing scope doc for TripView and route-loader orchestration regression coverage.
- [ ] [Internal] 🧱 Expanded regression coverage with additional malformed-input and storage-failure tests for destination lookup, flag normalization, trip storage, and trip history services.
- [ ] [Internal] 🧪 Started phase-2 UI orchestration tests with TripView view-sync hooks and route-loader fallback/shared-state regression coverage.
- [ ] [Internal] 🧩 Extended phase-2 loader coverage with SharedTrip and ExampleTrip route tests for missing resource redirects, prefetch hydration, and copy/create orchestration callbacks.
- [ ] [Internal] 🛂 Added phase-2 regression tests for shared-trip edit commits (history + db update) and example-trip limit-denied routing to pricing.
