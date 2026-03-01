---
id: rel-2026-03-01-trip-reactivation-bridge
version: v0.74.0
title: "Expired trip reactivation bridge for signed-in users"
date: 2026-03-01
published_at: 2026-03-01T12:27:17Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Signed-in travelers can now reactivate expired trips instantly while we prepare the full subscription upgrade flow."
---

## Changes
- [x] [Fixed] 🔓 Signed-in users can now reactivate expired trips immediately without getting stuck behind a login overlay loop, and the reactivation now persists across profile sync.
- [x] [Improved] 🧭 Expired-trip activation messaging is now clearer about when you need to sign in versus when reactivation happens instantly.
- [ ] [Internal] 🧾 Prevented duplicate-key warnings in admin audit diff rendering when multiple timeline changes share the same label.
- [ ] [Internal] 🧩 Unified trip-expiry recalculation into shared entitlement-based helpers used by app and route loaders.
- [ ] [Internal] 📚 Documented the temporary reactivation bridge and linked the subscription handoff backlog with a 7-day post-cancel grace policy follow-up.
