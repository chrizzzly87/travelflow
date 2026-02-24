---
id: rel-2026-02-24-storage-consent-policy-phase2-migration
version: v0.58.0
title: "Storage consent policy phase 2 migration"
date: 2026-02-24
published_at: 2026-02-24T13:20:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Migrates auth/session and consent-adjacent storage callers to registry-backed storage policy helpers."
---

## Changes
- [ ] [Internal] 🔒 Migrated auth/session storage callers to `browserStorageService` helper APIs.
- [ ] [Internal] 🧭 Migrated consent-adjacent banner and release-notice storage access to policy-backed helper APIs.
- [ ] [Internal] 🧪 Added regression coverage for auth trace persistence and documented remaining migration batches.
