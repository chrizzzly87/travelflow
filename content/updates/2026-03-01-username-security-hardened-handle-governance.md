---
id: rel-2026-03-01-username-security-hardened-handle-governance
version: v0.71.0
title: "Username security hardening follow-up spec"
date: 2026-03-01
published_at: 2026-03-01T07:05:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Defined a full implementation issue for secure username governance, canonical lowercase routing, and denylist management."
---

## Changes
- [x] [Improved] 🛡️ Username setup now enforces stricter handle safety rules (3-20 characters, only letters/numbers/`_`/`-`, and stronger blocked-name protection).
- [x] [Improved] 🔁 Public profile links now auto-canonicalize to lowercase URLs while your chosen username casing is still shown in profile UI.
- [ ] [Internal] 🧭 Added an implementation-ready open-issue spec for username security hardening, canonical lowercase URLs, and display-casing preservation.
- [ ] [Internal] 🧱 Added DB-managed denylist and reserved-handle governance with category metadata and owner-assignable protected names.
- [ ] [Internal] 🧪 Added regression coverage for mixed-case canonical routing, frontend username validation feedback/sanitization, and canonical/display mapping.
- [ ] [Internal] 🐙 Created and linked GitHub issue #208 to keep the tracked spec and issue workflow aligned.
