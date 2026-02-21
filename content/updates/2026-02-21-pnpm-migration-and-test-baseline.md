---
id: rel-2026-02-21-pnpm-migration-and-test-baseline
version: v0.53.0
title: "Tooling baseline: pnpm migration and test scaffolding"
date: 2026-02-21
published_at: 2026-02-21T14:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Migrated repository tooling to pnpm defaults and added a first automated unit/component/e2e test baseline for local and CI use."
---

## Changes
- [ ] [Internal] 📦 Migrated the repository from npm lockfile workflows to pnpm (`pnpm-lock.yaml`, `packageManager`, pnpm-first scripts, and deploy command updates for Netlify/Vercel).
- [ ] [Internal] 🧪 Added Vitest + Testing Library baseline setup with a first unit and component smoke test.
- [ ] [Internal] 🎭 Added Playwright baseline configuration with a homepage smoke test and dedicated `pnpm test:e2e` script.
- [ ] [Internal] 📘 Updated tooling docs to use pnpm commands consistently, including release-version helper command references.
