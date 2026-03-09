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
- [ ] [Internal] 🧭 Moved billing into a dedicated `/checkout` flow with branded plan review, profile enrichment, and trip-aware handoff metadata so pricing and locked-trip upgrades feed the same Paddle path.
- [ ] [Internal] 🎨 Reworked the dedicated checkout route into a leaner three-step flow with inline auth, traveler details, main-column payment, email-confirmation terms finalization, and cleaner mobile-first form styling.
- [ ] [Internal] ✅ Corrected the checkout summary rail to use a simpler accent bottom-border tab state and stronger completed-step markers that match the rest of the app better.
- [ ] [Internal] 🧭 Kept traveler details editable after the Paddle frame loads, removed the stuck signup-wait state, and switched same-origin checkout reloads to in-app navigation for a faster step-3 handoff.
- [ ] [Internal] ✅ Replaced the post-payment toast-only state with a real success step that can resume queued trip generation, return users to a claimed trip, or guide them into create-trip/profile next actions.
- [ ] [Internal] 🔎 Exposed non-secret webhook sync diagnostics in the Paddle config endpoint and documented that sandbox webhook destinations must allow simulation traffic, because otherwise admin billing stays empty even when sandbox checkout succeeds.
- [ ] [Internal] 🧾 Added the first admin billing workspace for subscription state and webhook visibility, plus the matching documented Supabase RPCs needed to read billing data under admin permissions.
- [ ] [Internal] 🔄 Added a manual Paddle reconciliation tool in admin so missed subscription webhooks can be repaired by fetching Paddle subscriptions and replaying them through the existing billing sync logic.
- [ ] [Internal] 🎛️ Realigned the checkout route with existing TravelFlow layout patterns by restoring the standard page width, widening the summary rail, using the shared tab treatment, and matching the app's card radius/border/shadow language.
- [ ] [Internal] 🧩 Replaced the checkout rail's broken tab chrome with a cleaner underline switcher, tightened country/flag alignment in traveler details, and corrected the shared admin header layout regression.
- [ ] [Internal] 🛠️ Hardened Paddle repair tooling with targeted `sub_...` reconciliation and retry-aware rate-limit handling so a single missed sandbox subscription can be reapplied without relying on the broad Paddle list scan.
- [ ] [Internal] 🧾 Added subscription-status pills and filtering to the admin users table so support can spot active, canceled, past-due, or missing billing state directly in the main user workspace.
- [ ] [Internal] 🎯 Reworked pricing cards and locked-trip upgrade surfaces so plan selection, trip-limit upsells, and expired-trip messaging now push users into the dedicated checkout flow with clearer Explorer/Premium value framing.
- [ ] [Internal] 🧭 Improved checkout completion for claim-based upgrades so successful payment can resume queued trip generation, surface the resulting trip directly, and avoid bouncing claim users toward irrelevant profile actions.
- [ ] [Internal] 🧪 Documented the recommended sandbox/live env strategy for local development, Netlify previews, and production so the eventual Paddle live cutover stays a Netlify-context swap instead of a code-level env rename exercise.
