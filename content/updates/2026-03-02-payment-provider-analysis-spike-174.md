---
id: rel-2026-03-02-payment-provider-analysis-spike-174
version: v0.77.0
title: "Payment provider decision memo for subscription launch"
date: 2026-03-02
published_at: 2026-03-02T10:45:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Completed the payment-provider spike and locked a MoR-first recommendation for upcoming subscription implementation."
---

## Changes
- [ ] [Internal] 🧮 Completed a weighted provider analysis for issue #174, selected Paddle as primary with Lemon Squeezy as backup, and froze the follow-up subscription integration contracts for issue #216.
- [ ] [Internal] 🔁 Added Paddle checkout/webhook implementation foundations for issue #216, including signature verification, webhook idempotency logging, Supabase subscription sync, and a dedicated setup/testing runbook.
- [ ] [Internal] 🧪 Added a `verify_only` webhook sync mode so real Paddle sandbox checkout and webhook delivery can be tested end-to-end before Supabase migration changes are merged.
- [ ] [Internal] 🗃️ Added a standalone Paddle billing SQL subset so the required Supabase schema can ship independently of the larger pending `docs/supabase.sql` merge.
