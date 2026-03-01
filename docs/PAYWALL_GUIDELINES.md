# TravelFlow Paywall Guidelines

This document defines the canonical paywall behavior for trips and the single decision path used in the app.

## Source Of Truth
- Paywall decision function: `config/paywall.ts` -> `shouldShowTripPaywall(trip, options?)`
- Lifecycle resolver: `config/paywall.ts` -> `getTripLifecycleState(trip, options?)`
- Paywalled display projection: `config/paywall.ts` -> `buildPaywalledTripDisplay(trip)`
- Activation mode resolver: `config/paywall.ts` -> `resolveTripPaywallActivationMode(options)`

## State Matrix
| Lifecycle state | Paywall shown | UI behavior | Data behavior |
|---|---|---|---|
| `active` | No | Full itinerary UI, map pins/routes visible, destination info visible. | Reads and writes allowed (subject to route/share mode permissions). |
| `expired` | Yes (except example previews) | Edit actions blocked, activation CTA shown, destination names masked to ordinal placeholders (`First destination`, `Second destination`, ...), destination info hidden, map pins/route lines/transport markers hidden. | Trip remains readable/openable, but treated as locked for editing until activation/entitlement; sharing is disabled and active share links are revoked. |
| `archived` | No (trip is not active in normal lists) | Not shown in normal trip lists; can be restored in future flows. | Trip persists in DB with archived status; excluded from active trip cap checks. |

## Current UI Contract For Expired Trips
- Top status strip explains expiration and activation.
- Center overlay explains lock and offers activation CTA.
- Timeline/city display uses paywalled projection, so city/location labels are masked.
- Map is still rendered, but:
  - city pins are hidden
  - route lines are hidden
  - transport markers are hidden
  - city label overlays are hidden
- Print view follows the same paywall masking and map-hiding behavior as planner view.
- Country info panel is hidden and replaced with a paywall message.

## Temporary Reactivation Bridge (Current)
- The activation CTA currently supports two explicit modes:
  - `direct_reactivate`: authenticated, non-anonymous users on `/trip/:id`.
  - `login_modal`: everyone else.
- In `direct_reactivate`, CTA click immediately updates trip lifecycle to `active` and recalculates `tripExpiresAt` from current user entitlements (`tripExpirationDays`), without opening auth modal.
- In `login_modal`, CTA keeps existing login-modal behavior and resume flow.
- This bridge is temporary until subscription-backed upgrade logic is implemented.
- Subscription follow-up tracking:
  - implementation issue: [#216](https://github.com/chrizzzly87/travelflow/issues/216)
  - payment/provider research dependency: [#174](https://github.com/chrizzzly87/travelflow/issues/174)

## Data Contract
- Trip expiry is trip-scoped (`tripExpiresAt` / `trip_expires_at`), not session-scoped.
- Active-trip cap excludes `archived` and counts non-archived trips.
- Expired trips remain persisted and openable.
- Deleting from UI archives trips (soft-delete model), preserving recoverability and source lineage.

## Decision Path Rules
- Always call `shouldShowTripPaywall(...)` to decide paywall presentation.
- Do not duplicate expiry checks (`status === 'expired'`, timestamp checks) in multiple UI components.
- Any future rules (plan checks, roles, grace periods, feature flags) should be added to `shouldShowTripPaywall(...)` and consumed everywhere from there.

## Future Login/Role Hooks
Planned additions should be integrated into the same decision layer:
- `userRole` / `planTier` / `entitlements`
- per-plan expiration windows
- reactivation permissions
- grace period logic
- A/B flags for paywall intensity

Planned subscription behavior:
- Users with upgraded subscriptions should remain unexpired while subscription is active.
- If a paid subscription is canceled, trip expiry should switch to a 7-day grace window before returning to expired state.
- This future implementation should replace the temporary direct-reactivation bridge while keeping the same CTA trigger points and analytics events.

Suggested extension shape:
- `shouldShowTripPaywall(trip, { lifecycleState, entitlements, nowMs, expiredOverride })`

## Tier Source Of Truth (V1)

1. Product-tier defaults come from `config/planCatalog.ts`.
2. Database plan seed should be generated from that file (`pnpm plans:generate-seed`).
3. Pricing UI reads tier limits directly from `planCatalog` with no runtime DB request.
4. If plan limits change, run:
   - `pnpm plans:generate-seed`
   - `pnpm plans:validate-sync`

## Debugging
- Browser helper in trip view: `toggleExpired()`
- `toggleExpired(true)` forces expired preview UI.
- `toggleExpired(false)` restores normal lifecycle evaluation.
- This is UI-only preview logic and does not persist trip status.
