# Trip Reactivation + Subscription Handoff (Deferred)

## Status
- Open GitHub implementation issue: [#216](https://github.com/chrizzzly87/travelflow/issues/216)
- Related payment-provider spike: [#174](https://github.com/chrizzzly87/travelflow/issues/174)
- Payment-provider decision (2026-03-02): **Primary Paddle**, **secondary Lemon Squeezy** (see `docs/open-issues/payment-provider-analysis-174.md`).
- Paddle implementation guide (2026-03-06): `docs/open-issues/paddle-setup-testing-guide-216.md` (includes `verify_only` webhook mode for sandbox E2E before Supabase migration is merged).

## Current Temporary Contract
1. Expired trip CTA uses `direct_reactivate` for authenticated non-anonymous users on `/trip/:id`.
2. Expired trip CTA uses `login_modal` for all other contexts.
3. Direct reactivation sets trip state to `active` and recalculates expiry from current entitlements.

## Target Subscription Contract
1. Upgraded subscriptions keep trips unexpired while subscription is active.
2. After paid subscription cancellation, apply a 7-day grace window.
3. After grace expiry, return trip lifecycle to expired/paywall state.
4. Keep existing CTA locations (`strip` + `overlay`) as canonical upgrade/reactivation triggers.
