---
id: rel-2026-07-02-ungate-homepage-auth
version: v0.141.0
title: "Faster homepage first paint"
date: 2026-07-02
published_at: 2026-07-02T20:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The homepage now appears immediately instead of waiting for sign-in checks to finish."
---

## Changes
- [x] [Improved] ⚡ The homepage now shows up right away — it no longer waits for background sign-in checks before appearing.
- [ ] [Internal] Removed the `suspendUntilAuthBootstrapSettles` Suspense-throw from `AuthenticatedMarketingHomeRoute` in `app/routes/DeferredAppRoutes.tsx`; `/` no longer blocks first paint on the Supabase chunk + `supabase.auth.getSession()`.
- [ ] [Internal] Signed-in visitors are still redirected to `/profile`: the synchronous persisted-session hint (`readPersistedSupabaseSessionHint`) keeps a lightweight non-suspending loading shell instead of flashing the marketing page until auth settles; stale hints fall back to the marketing page.
- [ ] [Internal] Regression tests in `tests/browser/routes/deferredAppRoutes.browser.test.ts`: anonymous `/` renders marketing content during auth bootstrap; hint-authenticated visitors keep the shell and land on `/profile` after settle; stale hints recover to the marketing page.
