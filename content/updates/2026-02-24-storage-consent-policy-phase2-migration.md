---
id: rel-2026-02-24-storage-consent-policy-phase2-migration
version: v0.58.0
title: "Storage consent policy phase 2 migration"
date: 2026-02-24
published_at: 2026-02-24T13:20:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Migrates auth/session, consent-adjacent, planner-setting, and trip persistence storage callers to registry-backed storage policy helpers."
---

## Changes
- [ ] [Internal] 🔒 Migrated auth/session storage callers to `browserStorageService` helper APIs.
- [ ] [Internal] 🧭 Migrated consent-adjacent banner and release-notice storage access to policy-backed helper APIs.
- [ ] [Internal] 🧾 Migrated consent bootstrap reads (`consentState`) to registry-backed storage helper APIs.
- [ ] [Internal] 🧩 Migrated tripview planner persistence hooks (`useTripLayoutControlsState`, `useTripResizeControls`, `useTripViewSettingsSync`) to policy-backed storage helpers.
- [ ] [Internal] 🔗 Migrated tripview share persistence hooks (`useTripCopyNoticeToast`, `useTripShareLifecycle`) to policy-backed storage helpers.
- [ ] [Internal] 🧱 Migrated admin cache utility and early-access banner storage access to policy-backed helper APIs.
- [ ] [Internal] 💾 Migrated trip persistence services (`storageService` and `historyService`) to policy-backed storage helpers.
- [ ] [Internal] ♻️ Added registry-backed fallback handling for Supabase wildcard auth keys that can appear in session storage.
- [ ] [Internal] 🧪 Added regression coverage for auth trace persistence, Supabase auth-key cleanup, and DB planner-setting persistence.
- [ ] [Internal] 🗂️ Updated the migration checklist to mark auth/db storage-call migrations complete and track remaining Phase 2 files.
