---
id: rel-2026-02-11-debugger-sim-login-tracking-stability
version: v0.47.0
title: "Debugger simulated-login tracking stability"
date: 2026-02-11
published_at: 2026-02-11T16:18:51Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Stabilized internal debugger simulated-login behavior so tracking-box toggles no longer drop auth-gated debug visibility."
---

## Changes
- [ ] [Internal] 🧪 Fixed a debugger lifecycle regression where toggling tracking boxes emitted a false simulated-login event and reset auth-gated internal UI.
- [ ] [Internal] 🔐 Synced debugger simulated-login writes with the shared DB simulation state so permission checks stay consistent.
