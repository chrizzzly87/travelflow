---
id: rel-2026-03-09-marketing-auth-bootstrap
version: v0.0.0
title: "Marketing auth bootstrap polish"
date: 2026-03-09
published_at: 2026-03-09T21:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Improves signed-in state hydration on marketing pages so returning users do not see the login CTA during the initial auth bootstrap window."
---

## Changes
- [x] [Improved] 🔐 Returning signed-in users on marketing pages now keep their account state visible during the initial page bootstrap instead of briefly falling back to the login CTA.
- [ ] [Internal] 🧭 Added a persisted Supabase session hint for non-critical routes and covered the header bootstrap regression with Vitest.
