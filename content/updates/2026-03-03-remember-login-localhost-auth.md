---
id: rel-2026-03-03-remember-login-localhost-auth
version: v0.0.0
title: "Remember login option and smoother local sign-in reuse"
date: 2026-03-03
published_at: 2026-03-03T10:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Added a remember-login control in sign-in flows and improved local auth session reuse during development."
---

## Changes
- [x] [Improved] 🔐 Added a "Remember login" option in sign-in page and modal flows so you can choose whether your session persists on that browser.
- [x] [Improved] ✍️ Improved sign-in autofill compatibility so browser-saved credentials submit reliably in both login page and modal flows.
- [ ] [Internal] 🧪 Added localhost auth-bridge persistence so valid sessions can be reused across different local development ports.
- [ ] [Internal] 🧹 Cleared localhost auth bridge cookies during auth recovery so stale local tokens cannot restore unexpectedly.
