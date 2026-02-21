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
