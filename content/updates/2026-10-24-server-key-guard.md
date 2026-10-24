---
id: rel-2026-10-24-server-key-guard
version: v0.208.1
title: "Server keys stay on the server"
date: 2026-10-24
published_at: 2026-10-24T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "AI provider keys can no longer reach the browser."
---

## Changes
- [ ] [Internal] 🔐 Drop the `VITE_GEMINI_API_KEY` server fallback; Gemini calls need `GEMINI_API_KEY`.
- [ ] [Internal] 🗺️ Trip agent Maps grounding needs `GOOGLE_MAPS_GROUNDING_API_KEY`; the browser Maps key is no longer used server-side.
- [ ] [Internal] 🧱 Builds fail when `VITE_GEMINI_API_KEY` is set, a `VITE_*` value equals a server secret, or a server secret appears in `dist/`.
