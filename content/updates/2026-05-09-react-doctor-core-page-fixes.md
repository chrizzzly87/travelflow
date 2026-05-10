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
- [x] [Fixed] 🛡️ Cookie and notice banners now dismiss safely without interrupting page loading.
- [ ] [Internal] 🩺 Cleared React Doctor error findings across the full repository scan, including hook-order, route-location dependency, and cleanup issues.
- [ ] [Internal] 🧪 Added regression coverage for the login modal hook fallback outside its provider.
- [ ] [Internal] 📋 Added a React Doctor remediation tracker plus future-feature score and effect-discipline guardrails.
- [ ] [Internal] 🧭 Reduced unnecessary effect-based state sync in auth, trip cards, and trip sharing flows.
