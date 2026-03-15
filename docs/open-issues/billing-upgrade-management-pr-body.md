## Summary
- adds an in-app Paddle upgrade flow for existing paid subscribers while keeping acquisition checkout unchanged for free users
- surfaces cancellation and billing-management entry points inside signed-in profile settings
- expands admin billing, users, and audit views with subscription lifecycle visibility and revenue charts

## What Changed
- added `get_current_user_subscription_summary()` and new billing dashboard/admin audit SQL support
- added authenticated Paddle endpoints for subscription preview, subscription change, and subscription management URLs
- updated pricing and checkout to distinguish current-plan, upgrade, and manage-billing states for paid subscribers
- added a signed-in billing management section to profile settings and a billing shortcut from the profile overview
- expanded admin billing with KPI cards and Tremor charts for current MRR, tier mix, status mix, and at-risk revenue
- expanded admin users and audit views so billing lifecycle data is visible alongside existing account operations
- synced the standalone Paddle SQL subset with the new RPCs and admin billing requirements

## Validation
- [x] `pnpm exec vitest run tests/browser/admin/adminBillingPage.browser.test.ts tests/browser/pricingPage.browser.test.ts tests/browser/checkoutPage.browser.test.ts tests/browser/profileSettingsPage.browser.test.ts tests/unit/adminAuditPage.labels.test.ts tests/unit/adminBillingPresentation.test.ts tests/unit/subscriptionState.test.ts tests/unit/paddleSubscriptionPreviewEdge.test.ts tests/unit/paddleSubscriptionChangeEdge.test.ts tests/unit/paddleSubscriptionManageEdge.test.ts tests/unit/billingService.test.ts`
- [x] `pnpm test:core`
- [x] `pnpm i18n:validate`
- [x] `pnpm supabase:validate`
- [x] `pnpm updates:validate`
- [ ] `pnpm dlx react-doctor@latest . --verbose --diff`

## Checklist
- [x] New service and edge modules have corresponding tests:
  - `tests/unit/subscriptionState.test.ts`
  - `tests/unit/paddleSubscriptionPreviewEdge.test.ts`
  - `tests/unit/paddleSubscriptionChangeEdge.test.ts`
  - `tests/unit/paddleSubscriptionManageEdge.test.ts`
  - `tests/unit/billingService.test.ts`
  - `tests/browser/pricingPage.browser.test.ts`
  - `tests/browser/checkoutPage.browser.test.ts`
  - `tests/browser/profileSettingsPage.browser.test.ts`
  - `tests/browser/admin/adminBillingPage.browser.test.ts`

## Follow-Up Checks
- run one fresh sandbox paid-to-paid upgrade after deploy and verify webhook/admin state stays in sync
- confirm the profile cancellation link reaches the correct Paddle hosted management screen in both sandbox and live contexts
