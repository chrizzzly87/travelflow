---
id: rel-2026-03-10-billing-upgrade-management
version: v0.0.0
title: "Billing upgrades and admin subscription visibility"
date: 2026-03-10
published_at: 2026-03-10T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Existing paid users can now upgrade plans in place, manage Paddle billing from profile settings, and see richer subscription state across the admin workspace."
---

## Changes
- [x] [Improved] ⬆️ Existing paid users can now upgrade from Explorer to Globetrotter inside the app without starting a second subscription from scratch.
- [x] [Improved] 💳 Profile settings now surface the current plan, renewal state, and direct billing-management and cancellation links so subscribers can find Paddle controls quickly.
- [x] [Fixed] 🧭 Checkout email confirmation now returns users back into the billing flow reliably, and billing management can recover Paddle subscription links even when local sync lags behind.
- [x] [Improved] 🧾 Checkout now locks already-complete traveler details by default, lets you reopen them only when needed, and moves straight into secure payment when your saved account details are already ready.
- [x] [Fixed] 🔄 Completed payments now run a stronger account-side subscription sync so new paid tiers show up on pricing and billing settings faster instead of leaving accounts in a stale free-tier state.
- [x] [Fixed] 💳 Reopening traveler details during checkout now cleanly restarts the secure payment step instead of leaving the inline payment form stuck in a loading state.
- [x] [Improved] 🎟️ Discount links and voucher codes now carry from pricing into checkout, and eligible savings are highlighted before payment so customers can see the benefit clearly.
- [x] [Fixed] 🛟 Account access now shows a clear support path when a preview or deployment is missing the required account-service connection, and auth forms flag invalid email input more clearly.
- [x] [Improved] 🧾 Admin billing now shows richer subscription details, current monthly recurring revenue by currency, status mix, and at-risk revenue charts.
- [x] [Improved] 🕵️ Admin user and audit views now surface billing lifecycle details so subscription mismatches and webhook-driven changes are easier to inspect.
- [ ] [Internal] 🔄 Added Paddle subscription preview, in-place subscription change, and billing-management endpoints plus the supporting Supabase RPCs for upgrade orchestration.
- [ ] [Internal] 🛡️ Checkout now blocks accidental second paid subscriptions, can recover a missing local billing record from the exact Paddle transaction, and broad Paddle reconciliation collapses duplicate sandbox subscriptions down to one best candidate per customer.
- [ ] [Internal] 🧭 Admin billing webhook cards now render processed sync notes with the correct non-error tone and handle long reconciliation event IDs more cleanly.
