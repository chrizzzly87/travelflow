---
id: rel-2026-03-19-netlify-runtime-location-debugger
version: v0.0.0
title: "Netlify runtime location snapshot diagnostics"
date: 2026-03-19
published_at: 2026-03-19T17:40:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Adds the first Netlify-backed runtime location snapshot so geo-aware experiments can read one shared session context and inspect it in the debugger."
---

## Changes
- [ ] [Internal] 🌍 Added a Netlify-backed runtime location snapshot endpoint plus session bootstrap plumbing for future geo-aware features.
- [ ] [Internal] 🧭 Added a runtime location card to the on-page debugger so city, country, timezone, postal code, and coordinates are visible during QA.
- [ ] [Internal] 🧪 Added edge and browser regression coverage for runtime location normalization, session caching, refresh flows, and debugger states.
