# TravelFlow Paywall Guidelines

This document defines the canonical paywall behavior for trips and the single decision path used in the app.

## Source Of Truth
- Paywall decision function: `config/paywall.ts` -> `shouldShowTripPaywall(trip, options?)`
- Lifecycle resolver: `config/paywall.ts` -> `getTripLifecycleState(trip, options?)`
- Paywalled display projection: `config/paywall.ts` -> `buildPaywalledTripDisplay(trip)`

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

Suggested extension shape:
- `shouldShowTripPaywall(trip, { lifecycleState, entitlements, nowMs, expiredOverride })`

## Debugging
- Browser helper in trip view: `toggleExpired()`
- `toggleExpired(true)` forces expired preview UI.
- `toggleExpired(false)` restores normal lifecycle evaluation.
- This is UI-only preview logic and does not persist trip status.
