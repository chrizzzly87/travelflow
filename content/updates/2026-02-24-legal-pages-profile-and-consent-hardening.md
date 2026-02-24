---
id: rel-2026-02-24-legal-pages-profile-and-consent-hardening
version: v0.56.0
title: "Legal pages and consent hardening"
date: 2026-02-24
published_at: 2026-02-24T07:56:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Legal disclosures now ship with finalized provider details and stronger browser-storage transparency."
---

## Changes
- [x] [Improved] ⚖️ Published finalized legal notice details for the responsible provider and content owner.
- [x] [Improved] 🔒 Legal profile data is managed from one typed source to keep future updates consistent.
- [x] [Fixed] 🧭 Kept legal page URLs canonical in English while locale-prefixed paths still work.
- [x] [Improved] 🍪 Expanded browser-storage disclosure so essential app/auth/session entries are documented in one registry.
- [ ] [Internal] ✅ Added a storage-registry validation command to catch unregistered persistence keys during development.
- [ ] [Internal] ✅ Added regression tests covering legal cookie registry helpers and legal-route canonical behavior.
