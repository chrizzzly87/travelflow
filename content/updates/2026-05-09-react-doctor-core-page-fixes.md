---
id: rel-2026-05-09-react-doctor-core-page-fixes
version: v0.0.0
title: "React Doctor repository cleanup"
date: 2026-05-09
published_at: 2026-05-09T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Cleans up the highest-priority React Doctor findings across core trip flows and the wider repository."
---

## Changes
- [x] [Fixed] 📅 Calendar-based trip dates now stay on the intended day across time zones in trip list markers and ticket previews.
- [x] [Fixed] 🧭 Cookie, notice, homepage inspiration, and navigation links now stay smooth while loading safely.
- [ ] [Internal] 🩺 Cleared React Doctor error findings across the full repository scan, including hook-order, route-location dependency, and cleanup issues.
- [ ] [Internal] 🧪 Added regression coverage for the login modal hook fallback outside its provider.
- [ ] [Internal] 📋 Added a React Doctor remediation tracker plus future-feature score and effect-discipline guardrails.
- [ ] [Internal] 🧭 Reduced unnecessary effect-based state sync in auth, trip cards, and trip sharing flows.
- [ ] [Internal] 🧹 Raised the latest React Doctor diff score to `84/100` by clearing safe duplicate styling, heading-weight, DOM-style batching, and repeated array-iteration findings.
- [ ] [Internal] ⚡ Raised the latest React Doctor diff score to `85/100` by consolidating safe state updates in auth, profile, blog, login, route-loading, and trip preview flows.
- [ ] [Internal] 🧯 Raised the latest React Doctor diff score to `87/100` by clearing flagged render-time date, loading-copy, and blog navigation findings.
- [ ] [Internal] 🧭 Raised the latest React Doctor diff score to `91/100` by clearing safe timeline, admin navigation, floating-map, and listener-subscription findings.
- [ ] [Internal] 🧾 Stopped committing generated coverage reports so validation runs no longer clutter PR diffs.
- [ ] [Internal] 🎞️ Raised the latest React Doctor diff score to `92/100` by consolidating intentional blog view-transition state commits.
- [ ] [Internal] 🔐 Reduced reset-password form state warning debt while preserving the existing auth UI behavior.
