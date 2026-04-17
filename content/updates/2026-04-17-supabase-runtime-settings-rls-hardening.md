---
id: rel-2026-04-17-supabase-runtime-settings-rls-hardening
version: v0.109.0
title: "Supabase runtime settings RLS hardening"
date: 2026-04-17
published_at: 2026-04-17T14:13:56Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Locks down a drifted Supabase runtime settings table and adds schema guardrails so public tables cannot quietly ship without RLS."
---

## Changes
- [ ] [Internal] 🔒 Added canonical `app_runtime_settings` schema coverage, admin-only RLS, and a public-safe runtime settings RPC so the raw settings table is no longer meant to be exposed directly.
- [ ] [Internal] 🛡️ Added a final public-table RLS sweep plus validator coverage so future schema drift is more likely to fail validation before it reaches production.
- [ ] [Internal] 🧪 Stabilized time-based profile and admin billing tests so the production build stays green as those cooldown and date-range windows age.
