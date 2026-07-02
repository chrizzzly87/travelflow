---
id: rel-2026-07-02-remove-client-gemini-key
version: v0.0.0
title: "Keep AI provider keys server-side only"
date: 2026-07-02
published_at: 2026-07-02T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Removed the browser-side AI provider key path so all AI generation runs through secured server endpoints."
---

## Changes
- [ ] [Internal] 🔒 Removed the browser-side Gemini API key fallback so all AI trip generation goes exclusively through server endpoints.
- [ ] [Internal] 🧹 Stopped injecting server AI keys into the client bundle at build time and removed the unused browser AI SDK dependency.
- [ ] [Internal] 🕵️ Re-enabled Netlify secrets scanning for the AI provider keys so any future client-bundle leak fails the build.
