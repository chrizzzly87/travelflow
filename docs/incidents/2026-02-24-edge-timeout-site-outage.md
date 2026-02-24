# Incident Postmortem: Edge Timeout Site Outage (2026-02-24)

## Summary
On February 24, 2026, TravelFlow intermittently returned `502 Bad Gateway` for core routes (including `/`, `/favicon.ico`, and image paths). Netlify surfaced edge runtime crashes with the message `Upstream lookup timed out`.

The primary blast radius came from a catch-all edge middleware route (`[[edge_functions]] path = "/*"`) that allowed upstream edge timeouts to impact nearly all requests.

## Impact
- User-visible impact: intermittent site unavailability and broken image delivery.
- Affected routes observed during incident:
  - `https://travelflowapp.netlify.app/`
  - `https://travelflowapp.netlify.app/favicon.ico`
  - `https://travelflowapp.netlify.app/.netlify/images?...`
- Typical observed response: `502 Bad Gateway` after ~10s timeout window.

## Detection
- First signal: user reports from production behavior (blog images not loading, then global site 502s).
- Netlify error page showed:
  - `This edge function has crashed`
  - `Upstream lookup timed out`
- Request identifiers captured during incident:
  - `01KJ8ATDR2T0BA5VBRHD1YE9SX`
  - `01KJ8BHDDMCVGQRMWW42TBADJ5`
  - `01KJ8BHQESZKDYE8WHQQMZZ7XS`

## Timeline (UTC)
- 2026-02-24 ~17:11 UTC: intermittent failures observed for Netlify image transform endpoint and production blog image loading.
- 2026-02-24 ~17:35-17:36 UTC: repeated `502` on core paths (`/`, `/favicon.ico`) reported.
- 2026-02-24 ~17:40 UTC: hotfix PR opened to remove global edge catch-all binding.
- 2026-02-24 ~17:42 UTC: hotfix PR merged to `main`.
- 2026-02-24 ~17:43 UTC: production recovered to `200` on core routes and image transform probes.
- 2026-02-24 ~18:00 UTC: follow-up regression identified (blog pages returned default OG metadata because `site-og-meta` had no active marketing-route bindings after catch-all removal).
- 2026-02-24 ~18:xx UTC: targeted marketing allowlist routes added for `site-og-meta` (including localized marketing prefixes), restoring OG coverage without global interception.
- 2026-02-24 ~19:17 UTC: second outage signal observed on `/` with `site-og-meta` timeout crashes (`Upstream lookup timed out`), indicating route scope was still too broad/high-traffic.
- 2026-02-24 ~19:xx UTC: remediation narrowed `site-og-meta` to blog-only routes and added edge fallback logic for upstream lookup failures.
- 2026-02-24 ~19:38 UTC: follow-up reports showed intermittent `Upstream lookup timed out` on OG endpoints (`/api/og/site`, `/api/og/playground`) during the static OG rollout window.
- 2026-02-24 ~19:xx UTC: additional hardening removed remote font-CDN fallback dependencies in OG image functions and enforced short font-fetch timeouts to avoid long edge waits on third-party upstreams.

## Root Cause
The production site had a catch-all edge middleware route:

- `[[edge_functions]] path = "/*"`
- `function = "site-og-meta"`

When upstream edge lookups timed out, this catch-all interception turned localized edge/runtime instability into broad user-visible availability failures.

## Contributing Factors
- No hard CI guardrail preventing catch-all edge route declarations.
- No synthetic uptime checks dedicated to core route health and image transform health.
- No immediate alerting path for 5xx spikes on root/static endpoints.
- Dynamic OG image endpoints depended on external font CDNs as fallback (`unpkg`, `fonts.gstatic.com`), which could stall edge rendering when upstream connectivity degraded.

## What Worked
- Fast live repro via direct probes to both raw assets and transformed image URLs.
- Rapid hotfix deployment by removing the catch-all edge route.
- Preview environment validation confirmed fix behavior before merge.

## What Did Not Work
- Detection was user-driven, not monitor-driven.
- The edge routing policy allowed a high blast-radius config in production.

## Corrective Actions

### Implemented immediately
- Removed catch-all edge binding from production routing (`/* -> site-og-meta`).
- Restored `site-og-meta` coverage using explicit route allowlists for static marketing/legal routes, `/create-trip`, and `/example/*` (including locale-prefixed variants).
- Added CI validator rule that fails if `netlify.toml` includes catch-all edge path `/*`.
- Added explicit edge policy documentation forbidding catch-all bindings.
- Added middleware fallback handling so `context.next()` timeouts no longer hard-crash the request path.
- Added build-time static OG image generation with hashed filenames and manifest lookup.
- Added static-first `og:image` resolution with dynamic `/api/og/site` fallback when no static manifest entry is available.
- Added CI validator rule that fails if `site-og-meta` is mapped outside the explicit safe-route allowlist.
- Added build validation to guarantee manifest/asset coverage for all static OG route keys.
- Removed remote font-CDN fallbacks from `/api/og/site` and `/api/og/trip` image rendering and limited font fetch waits with request-level timeouts.
- Added regression test coverage for OG font URL resolution to ensure only local font assets are used.

### Planned follow-ups (high priority)
- Add synthetic monitoring checks (every 1 minute):
  - `GET /`
  - `GET /favicon.ico`
  - `GET /.netlify/images?url=/images/blog/how-to-plan-multi-city-trip-card.webp&w=1024&q=66`
  - `GET /api/og/site?title=Health&description=Health&path=/health`
  - `GET /api/og/playground`
- Alert on thresholds:
  - >=2 consecutive failures per endpoint
  - 5xx ratio above threshold in 5-minute window
- Route alerts to primary channel (Slack/email/pager).
- Add a lightweight status/check dashboard section in runbook.

## Prevention Policy (must keep)
- No catch-all edge middleware routes in production.
- Edge middleware must use explicit route allowlists with small blast radius.
- Any edge routing change must include:
  - CI validation pass (`pnpm edge:validate`)
  - preview smoke probes for root/static/image-transform endpoints
  - rollback plan in PR description

## Ownership
- Incident owner: Platform/infra maintainers.
- Follow-up tracking: dedicated GitHub issue linked from this postmortem.
