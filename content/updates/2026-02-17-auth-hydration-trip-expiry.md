---
id: rel-2026-02-17-auth-hydration-trip-expiry
version: v0.56.0
title: "Trip expiry respects signed-in access during hydration"
date: 2026-02-17
published_at: 2026-02-17T19:11:21Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Trip creation now avoids applying guest expiry windows before signed-in access state is ready."
---

## Changes
- [x] [Fixed] 🔐 New trips created right after sign-in no longer get guest-style expiry limits while account access is still loading.
- [ ] [Internal] 🧠 Added session-aware trip-expiry resolution so authenticated/unknown sessions defer to server entitlement rules instead of forcing the anonymous fallback.
