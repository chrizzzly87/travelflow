---
id: rel-2026-03-01-username-security-hardened-handle-governance
version: v0.71.0
title: "Username security hardening follow-up spec"
date: 2026-03-01
published_at: 2026-03-01T07:05:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Expanded username hardening with 3-40 handle limits, stricter DB-backed deny/reserved governance, and clearer category-based denylist documentation."
---

## Changes
- [x] [Improved] 🛡️ Username setup now enforces stricter handle safety rules (3-40 characters, only letters/numbers/`_`/`-`, stronger blocked-name protection, and `tamtam*` brand-reserved variants).
- [x] [Improved] 🔁 Public profile links now auto-canonicalize to lowercase URLs while your chosen username casing is still shown in profile UI.
- [ ] [Internal] 🧭 Added an implementation-ready open-issue spec for username security hardening, canonical lowercase URLs, and display-casing preservation.
- [ ] [Internal] 🧱 Added DB-managed denylist and reserved-handle governance with category metadata and owner-assignable protected names.
- [ ] [Internal] 🧾 Added optional blocked-attempt event logging during submit-time username availability checks for audit visibility.
- [ ] [Internal] 🛠️ Fixed admin username editing to hydrate and persist mixed-case display usernames instead of reverting the field to lowercase canonical values.
- [ ] [Internal] 🧰 Added an admin one-click username cooldown reset action with drawer visibility into last username-change timestamp and cooldown end state.
- [ ] [Internal] 🧪 Added regression coverage for mixed-case canonical routing, frontend username validation feedback/sanitization, and canonical/display mapping.
- [ ] [Internal] 🐙 Created and linked GitHub issue #208 to keep the tracked spec and issue workflow aligned.
