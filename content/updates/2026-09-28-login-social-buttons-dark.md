---
id: rel-2026-09-28-login-social-buttons-dark
version: v0.198.0
title: "Readable social sign-in in dark mode"
date: 2026-09-28
published_at: 2026-09-28T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The Google, Facebook and Kakao sign-in buttons on the login page now hover the same way as in the sign-in dialog, including in dark mode."
---

## Changes
- [x] [Fixed] 🔑 In dark mode, hovering "Continue with Google" or Facebook on the login page no longer turns the button near-white and hides its label.
- [x] [Fixed] ➖ The "or continue with" divider on the login page is no longer bright white in dark mode.
- [ ] [Internal] 🧩 The login page and the sign-in dialog share one social sign-in button, built on the shared button component with a new `social` variant that tints by provider.
- [ ] [Internal] 🧪 Added a test for the shared social button, its dark hover tint and the Kakao-first order for Korean.
