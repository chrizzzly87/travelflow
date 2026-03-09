---
id: rel-2026-02-24-storage-consent-policy-phase1
version: v0.58.0
title: "Storage consent policy phase 1"
date: 2026-02-24
published_at: 2026-02-24T10:15:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Phase 1 introduces a central storage policy helper and consent-aware optional storage enforcement."
---

## Changes
- [x] [Improved] 🛡️ Optional browser-storage keys are now enforced through a central consent-aware policy helper in critical paths.
- [x] [Improved] 🧹 Switching back to essential-only consent now clears optional analytics storage keys automatically.
- [ ] [Internal] ✅ Added regression tests for storage policy behavior, wildcard registry lookups, and consent-triggered optional-key purge.
