---
id: rel-2026-09-20-prerender-shell-guard
version: v0.186.0
title: "A guard on the page capture step"
date: 2026-09-20
published_at: 2026-09-20T17:10:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Internal: the page capture step now proves each page started from a clean shell, so the homepage cannot silently leak into another page again."
---

## Changes
- [ ] [Internal] 🛡️ The prerender step now re-fetches each route's own document and fails that route if it was served an already-captured page. v0.185.0 fixed the cause by holding the homepage back until the run ends; this proves the invariant held, because the damage it prevents is invisible — another page's leftover markup baked into the capture, shipped, and only visible on a direct load.
- [ ] [Internal] ✅ Added unit coverage for the shell check, including a test pinning the reader to the marker the writer actually emits.
