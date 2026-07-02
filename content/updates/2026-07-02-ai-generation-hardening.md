---
id: rel-2026-07-02-ai-generation-hardening
version: v0.0.0
title: "AI generation endpoint hardening"
date: 2026-07-02
published_at: 2026-07-02T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Server-side safeguards keep AI trip generation reliable and abuse-resistant."
---

## Changes
- [ ] [Internal] 🛡️ Added Supabase session verification, per-user/per-IP rate limiting, prompt-length caps, and provider/model allowlist enforcement to the public AI generation edge endpoint to prevent unauthenticated paid-provider quota abuse.
- [ ] [Internal] 📏 Async generation enqueue now rejects queued payload prompts above the shared prompt-length cap.
- [ ] [Internal] 🔍 Generation telemetry now records the verified user id and auth mode for each request.
