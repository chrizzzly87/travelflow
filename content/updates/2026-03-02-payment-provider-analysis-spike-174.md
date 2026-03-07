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
- [ ] [Internal] 🚦 Added a sandbox-first rollout plan, corrected Paddle sandbox API routing, and documented the live cutover path so billing can move from test to production by swapping environment and Paddle-side objects.
- [ ] [Internal] 🪪 Added browser-side Paddle.js initialization with a public client token so transaction checkout links can open correctly on the pricing page during sandbox and live testing.
- [ ] [Internal] 🧭 Added Paddle environment diagnostics and public tier-availability bootstrapping so sandbox/live credential mismatches fail clearly and unconfigured paid tiers stay disabled on the pricing page.
- [ ] [Internal] 🎛️ Reworked the pricing-page checkout handoff into a branded one-page inline Paddle shell so sandbox and live billing feel closer to the product instead of a raw provider modal.
