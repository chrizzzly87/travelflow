---
id: rel-2026-09-28-vitest-collect-tsx-tests
version: v0.202.0
title: "Run every component test"
date: 2026-09-28
published_at: 2026-09-28T16:28:43Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Three component test files that were silently skipped now run in CI."
---

## Changes
- [ ] [Internal] 🧪 Vitest now collects `tests/**/*.test.tsx`; `createTripClassicLabPage`, `printLayout` and `profileTripCard` browser tests were never run by `test:core` or CI because the include only matched `.ts` under `tests/`.
- [ ] [Internal] 🪪 Updated the stale `ProfileTripCard` expired-draft test: it expected the `expiredFallbackTitle` swap that 688ecb2fe removed on purpose, and now asserts the card keeps the trip title next to the expired badge.
