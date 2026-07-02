---
id: rel-2026-07-02-voucher-lookup-hardening
version: v0.140.0
title: "Harden checkout voucher lookup"
date: 2026-07-02
published_at: 2026-07-02T19:43:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Hardened the checkout voucher lookup against automated code guessing."
---

## Changes
- [ ] [Internal] 🛡️ Added per-IP, per-code, and per-user token-bucket rate limiting to the public Paddle voucher lookup edge function.
- [ ] [Internal] 🔎 Voucher lookups now validate code charset/length and tier allowlist before any Paddle API call.
- [ ] [Internal] 🤐 Negative voucher lookups return a single uniform response (with a small constant delay), removing the discount-catalog oracle; description-based matching was removed entirely.
- [ ] [Internal] 📦 Minimized the voucher lookup response to the fields the checkout UI renders (no more discount descriptions or recurrence metadata).
- [ ] [Internal] 🪪 Signed-in checkout visitors now send their Supabase session token so lookups are additionally rate limited per verified user.
