# Payment Provider Analysis (#174)

## Status
- Issue: [#174](https://github.com/chrizzzly87/travelflow/issues/174)
- Date finalized: 2026-03-02
- Scope: decision memo only (no production billing implementation in this spike)

## Locked Scope
1. Web-only launch in the next 6-12 months.
2. Self-serve subscriptions only (no sales-led invoicing in phase 1).
3. German solo founder context (Kleinunternehmer assumption) with strong preference for minimal VAT/compliance operations in-house.
4. Global checkout support and low ongoing manual effort.

## Method
- Providers reviewed: Paddle, Lemon Squeezy, Stripe, Braintree, FastSpring, Chargebee, RevenueCat, Superwall.
- Weighted scoring model:
  - VAT/tax/compliance burden: **30%**
  - Total cost at low volume (< EUR 10k MRR): **20%**
  - Integration effort with React + Netlify + Supabase: **20%**
  - Subscription lifecycle features (dunning/retries/cancel/grace support): **15%**
  - Dashboard/reporting quality: **10%**
  - Migration risk/future flexibility: **5%**

## Weighted Scorecard
Scoring scale: 1 (weak) to 5 (strong). Higher weighted score is better for this specific founder profile.

| Provider | VAT/Compliance (30) | Low-Volume Cost (20) | Integration Fit (20) | Subscription Lifecycle (15) | Dashboard (10) | Migration Risk (5) | Weighted Score (/100) | Notes |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Paddle | 5 | 3 | 4 | 4 | 4 | 3 | **81** | MoR model strongly reduces tax ops; higher take-rate tradeoff. |
| Lemon Squeezy | 5 | 3 | 4 | 3 | 3 | 3 | **76** | MoR + indie-first simplicity; somewhat lighter enterprise controls. |
| Stripe | 2 | 3 | 5 | 5 | 5 | 5 | **74** | Excellent product/SDK stack, but tax/compliance burden stays with merchant. |
| Braintree | 2 | 3 | 3 | 4 | 3 | 4 | 58 | Solid processor option, less aligned with low-ops VAT goal. |
| FastSpring | 5 | 1 | 1 | 3 | 3 | 2 | 55 | MoR benefits, but pricing transparency and integration clarity are weaker for this phase. |
| Chargebee | 2 | 2 | 2 | 5 | 4 | 3 | 54 | Strong subscription engine, but heavier setup/cost profile for pre-scale solo launch. |
| RevenueCat | 1 | 2 | 2 | 4 | 4 | 3 | 45 | Better fit for app-store/mobile subscription orchestration than web-first SaaS checkout. |
| Superwall | 1 | 2 | 2 | 3 | 3 | 3 | 40 | Primarily paywall experimentation layer, not a complete web billing backbone. |

## Public Pricing Snapshot (checked 2026-03-02)
- **Paddle:** published base pricing at **5% + $0.50 per transaction**, positioned as MoR with tax handling claims [S3][S4].
- **Lemon Squeezy:** published base pricing at **5% + $0.50 per transaction**, MoR/tax handling claims, with note that additional fees can apply in edge cases [S5][S6].
- **Stripe:** published self-serve online card pricing in DE and separate Stripe Tax pricing page (tax tooling as an additional product cost center) [S1][S2].
- **Braintree/PayPal DE:** fee content is published via PayPal business fees experience/PDF structure, but less immediately comparable in one simple transparent startup table [S13].
- **FastSpring:** pricing page emphasizes sales-led/custom engagement and MoR/tax value positioning over simple self-serve transparent startup rate cards [S12].
- **Chargebee:** pricing is tiered and oriented around broader billing infrastructure; useful later, heavy for first bootstrap launch [S10][S11].
- **RevenueCat:** pricing and docs emphasize subscription infrastructure and web billing support, but primary strength remains cross-platform/mobile subscription lifecycle orchestration [S7][S8].
- **Superwall:** web paywalls exist, but product focus is paywall experimentation/optimization layer rather than full web billing operations [S9].

## Cost Scenarios (EUR 1k / 5k / 10k MRR)
Assumptions for comparable scenario math:
- Average order value (AOV): **EUR 10**
- Monthly transactions: 100 / 500 / 1000
- Uses published base fee formulas only where transparent and directly self-serve comparable.

| Provider | Formula Used | EUR 1k MRR | EUR 5k MRR | EUR 10k MRR | Comment |
|---|---|---:|---:|---:|---|
| Paddle | 5% + $0.50/txn (treated as approx EUR 0.50) [S3] | ~EUR 100 | ~EUR 500 | ~EUR 1,000 | MoR convenience premium is visible at low AOV. |
| Lemon Squeezy | 5% + $0.50/txn (treated as approx EUR 0.50) [S5] | ~EUR 100 | ~EUR 500 | ~EUR 1,000 | Similar economics to Paddle at this ticket size. |
| Stripe (base cards only) | DE published card pricing framework [S1] | lower than MoR options in raw processing | lower than MoR options in raw processing | lower than MoR options in raw processing | Raw fee can be lower, but tax/compliance workload remains with merchant; Stripe Tax/tooling cost center separate [S2]. |
| Braintree / FastSpring / Chargebee / RevenueCat / Superwall | N/A for direct apples-to-apples startup table | N/A | N/A | N/A | Pricing model is sales/custom/tiered/non-equivalent for this simple checkout scenario [S7][S9][S10][S12][S13]. |

## Legal/Operational Scenario Check
### 1) EU B2C digital services
- EU VAT obligations are destination-based once thresholds/conditions are met, with OSS available as reporting simplification [S14][S15].
- MoR providers (Paddle/Lemon) materially reduce direct founder workload because tax determination/collection/remittance is part of their value proposition [S4][S5][S6].

### 2) EU B2B reverse charge
- Reverse-charge and VAT-ID logic still need reliable handling in invoicing/tax flows [S14].
- MoR path reduces manual operational burden versus processor-only setups where the merchant bears full compliance workflow [S4][S6].

### 3) Non-EU sales
- VAT treatment differs for non-EU scenarios; merchant still needs a defensible system for jurisdiction logic and records [S14].
- MoR model lowers hands-on tax operations overhead for a solo founder selling globally [S4][S6].

## Recommendation
### Primary: Paddle
**Why:** Best alignment with this specific problem: German bootstrap founder, low legal/ops capacity, web-only SaaS launch, global checkout needs, subscription support, and dashboard visibility.

**Tradeoff accepted:** Higher effective transaction take-rate at low AOV versus processor-first.

### Secondary: Lemon Squeezy
**Why:** Very similar MoR value proposition and startup-friendly simplicity.

**Tradeoff accepted:** Slightly weaker perceived depth for future complex SaaS billing operations compared with Paddle-first path.

### Deprioritized for phase 1
- **Stripe/Braintree:** strong processors, but tax/compliance burden remains mostly on merchant.
- **Chargebee:** high-capability platform, but over-scoped for pre-scale solo launch.
- **RevenueCat/Superwall:** not first-choice billing backbone for this web-only phase.
- **FastSpring:** MoR-capable, but transparency and integration predictability are less favorable for this phase.

## Notes and Constraints
- This document is operational planning, not legal/tax advice.
- German legal basis considered: UStG §19 (Kleinunternehmer) threshold framework [S16].
- If business setup/tax status changes (for example standard VAT registration), re-run this analysis.

## Source Index (all checked on 2026-03-02)
- [S1] Stripe pricing (DE): https://stripe.com/de/pricing
- [S2] Stripe Tax pricing: https://stripe.com/tax/pricing
- [S3] Paddle pricing: https://www.paddle.com/pricing
- [S4] Paddle MoR/tax context: https://www.paddle.com/help/start/intro-to-paddle/what-does-paddle-do
- [S5] Lemon Squeezy pricing: https://www.lemonsqueezy.com/pricing
- [S6] Lemon Squeezy fees docs: https://docs.lemonsqueezy.com/help/getting-started/fees
- [S7] RevenueCat pricing: https://www.revenuecat.com/pricing/
- [S8] RevenueCat web billing: https://www.revenuecat.com/docs/web/web-billing
- [S9] Superwall web paywalls: https://superwall.com/features/web-paywalls
- [S10] Chargebee pricing: https://www.chargebee.com/pricing/
- [S11] Chargebee supported gateways: https://www.chargebee.com/payment-gateways/
- [S12] FastSpring pricing: https://fastspring.com/solutions/pricing/
- [S13] PayPal/Braintree DE fees: https://www.paypal.com/de/business/paypal-business-fees
- [S14] EU cross-border VAT: https://europa.eu/youreurope/business/taxation/vat/cross-border-vat/index_en.htm
- [S15] EU OSS: https://europa.eu/youreurope/business/taxation/vat/one-stop-shop/index_en.htm
- [S16] German UStG §19: https://www.gesetze-im-internet.de/ustg_1980/__19.html
