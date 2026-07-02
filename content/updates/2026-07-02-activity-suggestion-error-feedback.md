---
id: rel-2026-07-02-activity-suggestion-error-feedback
version: v0.127.0
title: "Clearer feedback for AI activity suggestions"
date: 2026-07-02
published_at: 2026-07-02T19:30:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Activity idea generation now tells you when it fails and lets you retry instantly."
---

## Changes
- [x] [Fixed] 💡 You now get clear feedback with a retry option when activity ideas fail to load.
- [ ] [Internal] Guarded the AI prompt Enter handler against duplicate in-flight generation requests in AddActivityModal.
- [ ] [Internal] Added localized error/retry copy for all active locales and regression tests for the AI proposal flow.
