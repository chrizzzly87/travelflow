---
id: rel-2026-02-13-auth-roles-pricing-guest-queue
version: v0.48.0
title: "Auth, Tiers, and Guest Trip Queue Foundation"
date: 2026-02-13
published_at: 2026-02-17T19:02:19Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Established production authentication, tiered access, and guest-to-account queue handoff so trip planning survives sign-in and account recovery."
---

## Changes
- [x] [New feature] 🔐 Launched production account authentication with email/password and major social sign-in providers.
- [x] [New feature] 🎒 Introduced Backpacker, Explorer, and Globetrotter plans with account-based trip limits.
- [x] [Improved] 💳 Updated pricing so plan limits are shown clearly and consistently.
- [x] [New feature] ⏳ Guest create-trip requests now resume after sign-in instead of being lost.
- [x] [Improved] 🛂 Added convenient sign-in and sign-out controls directly in planner and example trip views.
- [x] [Improved] 🔑 Added password recovery and password-setup flows so users can regain account access more reliably.
- [x] [Fixed] 🧯 Improved sign-in flow resilience so users return to the right place after authentication interruptions.
- [ ] [Internal] 🧪 Added protected admin access sections and navigation structure for internal role and benchmark workflows.
- [ ] [Internal] 📈 Added structured auth observability and recovery event tracing for login and password flows.
- [ ] [Internal] 🛡️ Hardened admin benchmark authorization and fallback handling for edge runtime checks.
- [ ] [Internal] 🌐 Added i18n guardrails and validation for ICU placeholder syntax, locale parity checks, and namespace placement guidance.
- [ ] [Internal] 🧭 Expanded Supabase auth setup documentation with dashboard mappings and local/production callback examples.
