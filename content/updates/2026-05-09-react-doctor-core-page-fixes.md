---
id: rel-2026-05-09-react-doctor-core-page-fixes
version: v0.0.0
title: "React Doctor core page cleanup"
date: 2026-05-09
published_at: 2026-05-09T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Cleans up the highest-priority React Doctor findings across the homepage, trip creation, and trip view flows."
---

## Changes
- [x] [Fixed] 📅 Calendar-based trip dates now stay on the intended day across time zones in trip list markers and ticket previews.
- [ ] [Internal] 🩺 Cleared the React Doctor error findings in the core non-admin page diff, including hook-order, route-location dependency, and map listener cleanup issues.
- [ ] [Internal] 🧪 Added regression coverage for the login modal hook fallback outside its provider.
