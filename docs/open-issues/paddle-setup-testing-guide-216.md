# Paddle Setup + Testing Guide (Issue #216)

## Scope
This guide covers the first production-ready Paddle integration path for TravelFlow:
- Checkout session creation via Netlify edge (`/api/billing/paddle/checkout`)
- Webhook-driven subscription sync (`/api/billing/paddle/webhook`)
- Supabase persistence + tier sync (`subscriptions`, `billing_webhook_events`, `profiles.tier_key`)

Reference issue: [#216](https://github.com/chrizzzly87/travelflow/issues/216)

## Current Flow (Implemented)
1. Signed-in user starts paid checkout from pricing.
2. Frontend calls `/api/billing/paddle/checkout` with tier key.
3. Edge function creates a Paddle transaction and returns hosted checkout URL.
4. Paddle sends webhook events to `/api/billing/paddle/webhook`.
5. Webhook handler verifies `Paddle-Signature`, deduplicates by `event_id`, and updates:
   - `public.subscriptions` canonical lifecycle row per user
   - `public.profiles.tier_key` (`tier_mid`/`tier_premium` or fallback `tier_free`)
   - `public.billing_webhook_events` log for replay/debug safety

## Required Environment Variables
Set these in Netlify (and locally when testing edge routes):

```bash
VITE_PADDLE_CHECKOUT_ENABLED=true
PADDLE_ENV=sandbox
PADDLE_API_KEY=...
PADDLE_WEBHOOK_SECRET=...
PADDLE_PRICE_ID_TIER_MID=pri_...
PADDLE_PRICE_ID_TIER_PREMIUM=pri_...   # optional
PADDLE_CHECKOUT_DOMAIN=                # optional
PADDLE_WEBHOOK_MAX_AGE_SECONDS=300     # optional

VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Paddle Dashboard Setup
1. Use **Sandbox** first in Paddle.
2. Create product + recurring price for `tier_mid` (Explorer).
3. Optional: create price for `tier_premium`.
4. Create webhook destination for each environment:
   - Sandbox: `https://<your-preview-or-tunnel>/api/billing/paddle/webhook`
   - Production: `https://<your-domain>/api/billing/paddle/webhook`
5. Copy the endpoint secret into `PADDLE_WEBHOOK_SECRET`.

Official docs:
- [Create transaction API](https://developer.paddle.com/api-reference/transactions/create-transaction)
- [Webhook signature verification](https://developer.paddle.com/webhooks/signature-verification)
- [Handle webhook delivery](https://developer.paddle.com/webhooks/handle-webhook-delivery)
- [Sandbox + test cards](https://developer.paddle.com/concepts/testing/test-cards)

## Database Setup
Apply the latest schema changes from [`docs/supabase.sql`](/Users/chrizzzly/.codex/worktrees/248f/travelflow-codex/docs/supabase.sql), specifically:
- `public.subscriptions` provider/lifecycle columns
- `public.billing_webhook_events` table
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
3. Log in with a real (non-anonymous) account.
4. Open `/pricing` and start checkout for paid tier.
5. Complete payment with Paddle sandbox test methods.

## Functional Test Matrix
### Checkout creation
- Expected: `/api/billing/paddle/checkout` returns `{ ok: true, data.checkoutUrl }`.
- Expected failure modes:
  - `401/403` when no authenticated non-anonymous user session
  - `400` when tier has no mapped `PADDLE_PRICE_ID_*`

### Webhook processing
Test with Paddle simulator and real sandbox flows:
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

## Go-Live Checklist
1. Switch `PADDLE_ENV=live`.
2. Replace API key, webhook secret, and price IDs with live values.
3. Point production webhook destination to production domain.
4. Keep `VITE_PADDLE_CHECKOUT_ENABLED=true` only when live config is fully set.
5. Run one real low-value transaction and validate:
   - webhook processed
   - tier sync applied
   - cancellation + grace behavior works as expected

## Known Constraints (Current Iteration)
- Tier mapping is price-ID driven; unmapped paid price IDs are intentionally ignored.
- Subscription lifecycle authority is webhook-first; checkout return alone does not grant access.
- Grace window policy is fixed to 7 days from cancellation timestamp.
