## Summary
- completes the payment-provider spike and early Paddle implementation path for issue #174
- keeps the rollout sandbox-first while making the later live cutover a configuration swap instead of a code rewrite
- adds the dedicated checkout, admin billing visibility, targeted reconciliation, and upgrade-entry improvements needed to validate subscriptions in the current stack

## What Changed
- added the payment-provider comparison memo and Paddle-first runbook
- implemented Paddle checkout, public config diagnostics, webhook verification, idempotent subscription sync, and targeted reconciliation tooling
- moved paid upgrades into a dedicated `/checkout` route with inline auth, traveler details, claim-aware handoff, and post-payment success actions
- added admin billing visibility and subscription-status pills in the admin users workspace
- improved pricing cards, trip-limit upsell prompts, and expired-trip upgrade messaging so locked users have a clearer upgrade path
- documented the recommended environment strategy: canonical env names, sandbox values for local/dev/preview, live values for production

## Data / Ops Notes
- Supabase SQL must be up to date before merge consumers validate admin billing and subscription-status filters
- Paddle sandbox and live should use the same env variable names with Netlify context separation, not duplicated `*_SANDBOX` and `*_LIVE` app config
- missed webhook cases can now be repaired from `/admin/billing` with targeted `sub_...` reconciliation

## Validation
- [x] `pnpm exec vitest run tests/browser/pricingPage.browser.test.ts tests/browser/checkoutPage.browser.test.ts tests/browser/routes/exampleTripLoaderRoute.browser.test.ts tests/browser/routes/sharedTripLoaderRoute.browser.test.ts test/components/TripViewStatusBanners.connectivity.test.tsx`
- [x] `pnpm test:core`
- [x] `pnpm updates:validate`
- [x] `pnpm dlx react-doctor@latest . --verbose --diff`
- [x] `pnpm dlx dotenv-cli -e .env.local -- pnpm build:netlify`
- [ ] fresh sandbox checkout verified after latest Paddle notification fix

## Checklist
- [x] New module guard completed
- [x] Corresponding tests added for new service modules:
  - `tests/unit/adminBillingPresentation.test.ts`
  - `tests/unit/billingService.test.ts`
  - `tests/unit/paddleClient.test.ts`
  - `tests/browser/checkoutPage.browser.test.ts`

## Follow-Up Checks
- verify one fresh sandbox checkout reaches `public.billing_webhook_events`, `public.subscriptions`, `public.profiles.tier_key`, `/admin/billing`, and `/admin/users`
- decide whether `Globetrotter` should be configured in the same rollout or remain follow-up scope

Closes #174
