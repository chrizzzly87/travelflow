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
  - `VITE_PADDLE_CHECKOUT_ENABLED` only (feature flag)
  - do not place Paddle secrets in browser-exposed vars

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
3. Log in with a real (non-anonymous) account.
4. Open `/pricing` and start checkout for paid tier.
5. Complete payment with Paddle sandbox test methods.

## Real Sandbox E2E Before Supabase Migration
Use this when Supabase schema updates are blocked by parallel work:
1. Set `PADDLE_WEBHOOK_SYNC_MODE=verify_only`.
2. Keep checkout enabled (`VITE_PADDLE_CHECKOUT_ENABLED=true`) and sandbox keys configured.
3. Run a real sandbox checkout from `/pricing`.
4. Confirm webhook delivery in Paddle dashboard:
   - Event status is delivered (or resendable) for `/api/billing/paddle/webhook`
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

## Go-Live Checklist
1. Switch `PADDLE_ENV=live`.
2. Replace API key, webhook secret, and price IDs with live values.
3. Point production webhook destination to production domain.
4. Set `PADDLE_WEBHOOK_SYNC_MODE=full`.
5. Keep `VITE_PADDLE_CHECKOUT_ENABLED=true` only when live config is fully set.
6. Run one real low-value transaction and validate:
   - webhook processed
   - tier sync applied
   - cancellation + grace behavior works as expected

## Known Constraints (Current Iteration)
- Tier mapping is price-ID driven; unmapped paid price IDs are intentionally ignored.
- Subscription lifecycle authority is webhook-first; checkout return alone does not grant access.
- Grace window policy is fixed to 7 days from cancellation timestamp.
- `verify_only` mode verifies webhooks but intentionally skips persistence/tier updates.
