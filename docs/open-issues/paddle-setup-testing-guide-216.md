# Paddle Setup + Testing Guide (Issue #216)

## Scope
This guide covers the first production-ready Paddle integration path for TravelFlow:
- Checkout session creation via Netlify edge (`/api/billing/paddle/checkout`)
- Webhook-driven subscription sync (`/api/billing/paddle/webhook`)
- Supabase persistence + tier sync (`subscriptions`, `billing_webhook_events`, `profiles.tier_key`)

Reference issue: [#216](https://github.com/chrizzzly87/travelflow/issues/216)

## Current Flow (Implemented)
1. User starts paid checkout from pricing or from a locked trip upgrade CTA.
2. Frontend calls `/api/billing/paddle/config` first to learn the active environment and which paid tiers are actually configured.
   - The config payload now also exposes non-secret billing sync diagnostics:
     - `webhookSecretConfigured`
     - `supabaseSyncConfigured`
     - `webhookSyncMode`
3. Frontend routes the user into the dedicated `/checkout` page with tier, source, return path, and optional claim/trip metadata.
4. `/checkout` keeps the flow in one place: account sign-in/registration first, traveler details second, and payment last.
5. If email confirmation is required, the confirmation link returns to `/checkout` and the app finalizes current-terms acceptance there before continuing.
6. Frontend calls `/api/billing/paddle/checkout` with tier key plus optional claim/trip/return metadata.
7. Edge function creates a Paddle transaction and returns a checkout URL that routes back to the dedicated `/checkout` page with Paddle transaction state.
8. `/checkout` initializes Paddle.js in one-page inline mode and renders the payment frame inside the branded checkout shell instead of dropping the user into Paddle's plain default overlay.
9. Paddle sends webhook events to `/api/billing/paddle/webhook`.
10. Webhook handler verifies `Paddle-Signature`, deduplicates by `event_id`, and updates:
   - `public.subscriptions` canonical lifecycle row per user
   - `public.profiles.tier_key` (`tier_mid`/`tier_premium` or fallback `tier_free`)
   - `public.billing_webhook_events` log for replay/debug safety

## Current Identity Model
- Supported now: visitor opens pricing or a locked trip -> lands on `/checkout` -> signs in or registers inline -> saves traveler details -> starts paid checkout.
- Not supported yet: truly anonymous checkout that grants a paid tier before a durable non-anonymous user session exists.
- Reason: the checkout endpoint stores `tf_user_id` in Paddle `custom_data` and currently requires an authenticated non-anonymous Supabase user so webhook tier sync can resolve a stable account.

## Required Environment Variables
Set these in Netlify (and locally when testing edge routes):

```bash
VITE_PADDLE_CHECKOUT_ENABLED=true
VITE_PADDLE_CLIENT_TOKEN=...
PADDLE_ENV=sandbox
PADDLE_API_KEY=...
PADDLE_WEBHOOK_SECRET=...
PADDLE_PRICE_ID_TIER_MID=pri_...
PADDLE_PRICE_ID_TIER_PREMIUM=pri_...   # optional
PADDLE_CHECKOUT_DOMAIN=                # optional
PADDLE_WEBHOOK_MAX_AGE_SECONDS=300     # optional
PADDLE_WEBHOOK_SYNC_MODE=full          # full | verify_only

VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...          # required when PADDLE_WEBHOOK_SYNC_MODE=full
```

## Where Configuration Lives (Paddle-first)
Use Paddle as the source of truth for commercial/billing setup:
- Paddle dashboard:
  - business/legal profile + tax handling
  - products + recurring prices
  - payment methods, checkout behavior, invoices, customer portal
  - webhook destinations per environment
- Netlify environment variables (server-side integration glue):
  - `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_PRICE_ID_*`, `PADDLE_ENV`, `PADDLE_WEBHOOK_SYNC_MODE`
- Vite/public env:
  - `VITE_PADDLE_CHECKOUT_ENABLED`
  - `VITE_PADDLE_CLIENT_TOKEN`
  - do not place Paddle secrets in browser-exposed vars

## Checkout Presentation Notes
- `/checkout` now hosts Paddle Checkout in an inline frame with one-page layout, light theme, and app-locale-aware initialization.
- The sandbox `Test mode` badge comes from Paddle and remains visible in sandbox. It disappears in live mode.
- The dedicated route now owns plan benefits, profile enrichment, trip-origin context, and mobile layout. For brand tuning inside the payment frame itself, use Paddle dashboard checkout branding/settings in the matching environment.

## Paddle Dashboard Setup
1. Use **Sandbox** first in Paddle.
2. Create a sandbox API key and store it as `PADDLE_API_KEY`.
   - In Paddle, go to `Developer tools -> Authentication -> API keys`.
   - Create a sandbox key with server-side access for transactions.
   - Copy it once and store it in Netlify/local env.
3. Create a sandbox client-side token and store it as `VITE_PADDLE_CLIENT_TOKEN`.
   - In Paddle, go to `Developer tools -> Authentication -> Client-side tokens`.
   - Create a sandbox token for Paddle.js.
   - This token is public/browser-safe and is required so the dedicated `/checkout` page can open Paddle Checkout from the transaction link.
   - Sandbox client-side tokens start with `test_`; live client-side tokens start with `live_`.
4. Create product + recurring price for `tier_mid` (Explorer).
   - In Paddle, go to `Catalog -> Products`.
   - Create a product for Explorer.
   - Add a recurring monthly price to that product.
5. Optional: create product/price for `tier_premium` (Globetrotter).
   - Repeat the same product + recurring price flow for Globetrotter.
6. Copy the recurring price IDs into env:
   - `PADDLE_PRICE_ID_TIER_MID`
   - `PADDLE_PRICE_ID_TIER_PREMIUM`
   - Open the product in Paddle and copy the `pri_...` ID from the price.
7. Ensure a default payment link is configured in Paddle for the sandbox account.
   - In Paddle, go to `Checkout -> Checkout settings -> Default payment link`.
   - Set it to your dedicated checkout page, because that page now loads Paddle.js and can open checkout from the transaction link.
   - Recommended value: `https://<your-netlify-preview-domain>/checkout`
8. Create a webhook destination for sandbox:
   - `https://<your-preview-or-tunnel>/api/billing/paddle/webhook`
   - In Paddle, go to `Developer tools -> Notifications`.
   - Click `New destination`.
   - Choose webhook destination and enter the URL above.
   - Enable **simulation** delivery for sandbox testing. If the destination is limited to platform/live traffic only, sandbox checkout can succeed while `billing_webhook_events` stays empty.
9. Subscribe the destination to the events this integration actually uses:
   - `subscription.created`
   - `subscription.activated`
   - `subscription.updated`
   - `subscription.canceled`
   - `transaction.completed`
10. Copy the webhook endpoint secret into `PADDLE_WEBHOOK_SECRET`.
   - Paddle generates this for the notification destination.
   - Use the destination secret, not the API key.
11. Keep the account in sandbox and use Paddle test payment methods/cards for end-to-end runs.
   - Basic sandbox card without 3DS: `4242 4242 4242 4242`, CVC `100`
   - Successful 3DS test card: `4000 0038 0000 0446`, CVC `100`
   - Declined test card: `4000 0000 0000 0002`, CVC `100`
   - Use any future expiry date and any cardholder name.

## Exact Env Mapping
- `PADDLE_API_KEY`
  - Comes from `Developer tools -> Authentication -> API keys`
  - For sandbox testing, do not use a live key. The app now rejects obvious mismatches like `pdl_live_apikey_*` with `PADDLE_ENV=sandbox`.
- `VITE_PADDLE_CLIENT_TOKEN`
  - Comes from `Developer tools -> Authentication -> Client-side tokens`
  - For sandbox testing, use the sandbox token (`test_...`), not a live token (`live_...`).
- `PADDLE_PRICE_ID_TIER_MID`
  - Comes from the recurring Explorer price (`pri_...`)
- `PADDLE_PRICE_ID_TIER_PREMIUM`
  - Comes from the recurring Globetrotter price (`pri_...`)
- `PADDLE_WEBHOOK_SECRET`
  - Comes from `Developer tools -> Notifications` on the webhook destination

## Minimum Paddle Setup To Test Your First Real Flow
If you want the shortest path to a working test, do only this in Paddle sandbox:
1. Create one sandbox API key.
2. Create one sandbox client-side token.
3. Create one product + one recurring price for Explorer.
4. Copy that Explorer `pri_...` into `PADDLE_PRICE_ID_TIER_MID`.
5. Set the sandbox default payment link to your preview `/checkout` page.
6. Create one webhook destination for `/api/billing/paddle/webhook`.
7. Subscribe it to `subscription.created`, `subscription.updated`, `subscription.canceled`, and `transaction.completed`.
   - Include `subscription.activated` too.
8. Copy its secret into `PADDLE_WEBHOOK_SECRET`.

You can leave `PADDLE_PRICE_ID_TIER_PREMIUM` empty until Explorer works.

## Common Sandbox Misconfiguration
If checkout fails with `You aren't permitted to perform this request.` during sandbox testing, check this first:
1. `PADDLE_ENV` must be `sandbox`.
2. `PADDLE_API_KEY` must come from Paddle sandbox, not live.
3. `VITE_PADDLE_CLIENT_TOKEN` must come from Paddle sandbox, not live.
4. The app now loads `/api/billing/paddle/config` before checkout and disables tiers that are not fully configured.
5. If Explorer is configured but Globetrotter is not, only Explorer should be testable until `PADDLE_PRICE_ID_TIER_PREMIUM` is added.
6. If sandbox checkout succeeds but `public.billing_webhook_events` stays empty, confirm the Paddle notification destination is allowed to send **simulation** traffic to your webhook URL.
7. If the original event was missed, use one of these recovery paths:
   - Replay the notification from Paddle.
   - Run **Reconcile Paddle** from `/admin/billing` to fetch Paddle subscriptions and replay them through TravelFlow's billing sync.
     - If Paddle rate-limits the broad scan, enter a specific `sub_...` subscription ID in the admin dialog to repair one subscription directly.

Official docs:
- [Create transaction API](https://developer.paddle.com/api-reference/transactions/create-transaction)
- [Paddle.js overview](https://developer.paddle.com/paddlejs/overview)
- [Webhook signature verification](https://developer.paddle.com/webhooks/signature-verification)
- [Handle webhook delivery](https://developer.paddle.com/webhooks/handle-webhook-delivery)
- [Sandbox + test cards](https://developer.paddle.com/concepts/testing/test-cards)

## Implementation Plan
1. Finish sandbox configuration in Paddle dashboard.
2. Verify checkout session creation locally or on a preview deployment with a signed-in non-anonymous user.
3. Verify webhook delivery in `verify_only` mode first when you only want transport/signature validation.
4. Switch to `full` sync mode once database writes should apply.
5. Validate internal state in `public.subscriptions`, `public.billing_webhook_events`, and `public.profiles.tier_key`.
6. Re-run the same scenario in Paddle live by swapping only environment variables and Paddle dashboard objects.

## Database Setup (Full Sync Mode)
If you want only the Paddle billing delta before your broader schema branch is ready, run:
- [`docs/open-issues/paddle-billing-subset-216.sql`](/Users/chrizzzly/.codex/worktrees/248f/travelflow-codex/docs/open-issues/paddle-billing-subset-216.sql)

If you want the full canonical schema instead, apply the latest changes from [`docs/supabase.sql`](/Users/chrizzzly/.codex/worktrees/248f/travelflow-codex/docs/supabase.sql).

The standalone subset is intentionally limited to:
- `public.subscriptions` provider/lifecycle columns
- `public.subscriptions.current_period_end` for older existing tables
- `public.billing_webhook_events` table
- `public.profiles.tier_key` safety/backfill for webhook tier sync
- related indexes + RLS policies

Quick verification queries:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'subscriptions'
order by column_name;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'billing_webhook_events'
order by column_name;
```

## Local Testing Workflow
1. Start app + Netlify edge proxy:

```bash
pnpm dev
pnpm dev:netlify
```

2. For local webhook delivery, expose port `8888` via a tunnel (for example `ngrok http 8888`) and use that URL in Paddle sandbox webhook destination.
3. Log in or register with a real (non-anonymous) account.
4. Open `/pricing` or a locked trip paywall and start checkout for `Explorer` or `Globetrotter`.
5. Complete payment with Paddle sandbox test methods.
6. Wait for webhook delivery and verify tier sync in Supabase.

## Recommended First End-to-End Scenario
1. Start from a logged-out browser session.
2. Open `/pricing`.
3. Click `Explorer` or `Globetrotter` to enter `/checkout`.
4. Complete the inline login/register step on `/checkout`.
5. Complete the traveler details step.
6. Continue into the Paddle payment step on the same `/checkout` route.
7. Pay with a Paddle sandbox payment method.
8. Confirm:
   - checkout stayed on `/checkout` with the branded inline frame
   - Paddle shows successful payment/subscription in sandbox
   - webhook reached `/api/billing/paddle/webhook`
   - `public.subscriptions` has the provider IDs and billing dates
   - `public.profiles.tier_key` changed to `tier_mid` or `tier_premium`
   - `public.billing_webhook_events` contains the raw event log

## Real Sandbox E2E Before Supabase Migration
Use this when Supabase schema updates are blocked by parallel work:
1. Set `PADDLE_WEBHOOK_SYNC_MODE=verify_only`.
2. Keep checkout enabled (`VITE_PADDLE_CHECKOUT_ENABLED=true`) and sandbox keys configured.
3. Run a real sandbox checkout from `/checkout`.
4. Confirm webhook delivery in Paddle dashboard:
   - Event status is delivered (or resendable) for `/api/billing/paddle/webhook`
   - Destination must be configured for simulation traffic, not platform-only delivery
5. Confirm endpoint response payload contains:
   - `ok: true`
   - `status: "ignored"`
   - `reason: "Webhook verified in verify_only mode; database sync skipped."`
   - `syncMode: "verify_only"`

This validates the full external loop (hosted checkout -> Paddle -> your real webhook endpoint) without requiring Supabase write paths.

## Promote To Full Sync After Merge
1. Apply Supabase schema updates from [`docs/open-issues/paddle-billing-subset-216.sql`](/Users/chrizzzly/.codex/worktrees/248f/travelflow-codex/docs/open-issues/paddle-billing-subset-216.sql) now, or the broader [`docs/supabase.sql`](/Users/chrizzzly/.codex/worktrees/248f/travelflow-codex/docs/supabase.sql) once your parallel schema branch is merged.
2. Set `PADDLE_WEBHOOK_SYNC_MODE=full`.
3. Ensure `SUPABASE_SERVICE_ROLE_KEY` is present.
4. Replay recent Paddle sandbox events (Webhook UI -> resend) to confirm persistence/tier sync.
   - If the original destination was created without simulation traffic, replay after correcting the destination settings.
5. Re-run the latest subset or canonical schema if you want `/admin/billing` to work, because the admin billing page depends on the seeded `billing.read` permission and the documented `admin_list_billing_*` RPCs.
6. If replay is incomplete or the webhook delivery history is missing, open `/admin/billing` and run **Reconcile Paddle**.
   - This is a manual repair tool.
   - It fetches Paddle subscriptions, synthesizes deterministic subscription events, and runs them through the same webhook sync logic used for normal delivery.
   - The admin flow now accepts an optional `sub_...` subscription ID so you can repair one known Paddle subscription without relying on the broader list endpoint.

## Functional Test Matrix
### Checkout creation
- Expected: `/api/billing/paddle/checkout` returns `{ ok: true, data.checkoutUrl }`.
- Expected failure modes:
  - `401/403` when no authenticated non-anonymous user session
  - `400` when tier has no mapped `PADDLE_PRICE_ID_*`

### Webhook processing
Test with Paddle simulator and real sandbox flows (in `full` sync mode):
1. `subscription.created`:
   - `subscriptions.provider_subscription_id` set
   - `profiles.tier_key` upgraded to mapped tier
2. `subscription.updated` (active/scheduled change):
   - lifecycle fields updated (`current_period_*`, `cancel_at`)
3. `subscription.canceled`:
   - `canceled_at` captured
   - `grace_ends_at = canceled_at + 7 days`
   - tier remains paid during grace window
4. Replay same `event_id`:
   - deduped (no duplicate tier churn)
5. Older event arrives after newer:
   - ignored as stale using `last_event_at`

Verification queries:

```sql
select *
from public.subscriptions
where user_id = '<supabase-user-uuid>';

select event_id, event_type, status, user_id, occurred_at, processed_at, error_message
from public.billing_webhook_events
order by created_at desc
limit 50;
```

## Admin Visibility Baseline
Use these tables as the source of truth for future admin billing pages/endpoints:
- `public.subscriptions`
  - current provider subscription id
  - current billing period dates
  - cancel/grace lifecycle state
  - current amount/currency snapshot
- `public.billing_webhook_events`
  - raw webhook audit log
  - event delivery/order debugging
  - replay/idempotency troubleshooting
- `public.profiles`
  - currently effective `tier_key`

Current internal admin billing view:
- `/admin/billing`
  - summary cards for active paid, grace-period, failed-webhook, and unlinked-event counts
  - searchable subscription rows
  - searchable webhook event log
  - links back to `/admin/users`

If `/admin/billing` shows a missing-function error, re-run the current subset or canonical schema file and reload the admin page.

## Go-Live Checklist
1. Clone or recreate the same products/prices in Paddle live.
2. Create a live API key and live webhook destination in Paddle.
3. Switch `PADDLE_ENV=live`.
4. Replace only these environment variables with live values:
   - `PADDLE_API_KEY`
   - `PADDLE_WEBHOOK_SECRET`
   - `PADDLE_PRICE_ID_TIER_MID`
   - `PADDLE_PRICE_ID_TIER_PREMIUM`
5. Point the production webhook destination to your production domain.
6. Set `PADDLE_WEBHOOK_SYNC_MODE=full`.
7. Keep `VITE_PADDLE_CHECKOUT_ENABLED=true` only when live config is fully set.
8. Run one real low-value transaction and validate:
   - webhook processed
   - tier sync applied
   - cancellation + grace behavior works as expected

## Known Constraints (Current Iteration)
- Tier mapping is price-ID driven; unmapped paid price IDs are intentionally ignored.
- Subscription lifecycle authority is webhook-first; checkout return alone does not grant access.
- Grace window policy is fixed to 7 days from cancellation timestamp.
- `verify_only` mode verifies webhooks but intentionally skips persistence/tier updates.
