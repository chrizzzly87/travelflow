---
id: rel-2026-02-10-on-page-debug-toolbar
version: v0.45.0
title: "On-page debugger toolbar"
date: 2026-02-11
published_at: 2026-02-11T11:29:38Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Internal QA toolbar now persists debugger toggles across reloads for faster testing."
---

## Changes
- [x] [Improved] 💬 Refined pricing and login messaging to be clearer, shorter, and more encouraging around upcoming paywall features.
- [ ] [Internal] 🧪 Added an internal on-page debugger toolbar for QA workflows.
- [ ] [Internal] 🧭 Expanded internal page diagnostics and validation shortcuts.
- [ ] [Internal] 🔒 Added route-scoped debug controls for trip-state QA scenarios.
- [ ] [Internal] 👤 Added a simulated-login debug toggle (`window.toggleSimulatedLogin`) for paywall and auth-gated flow testing.
- [ ] [Internal] 💾 Persisted debugger toggle states (tracking boxes, panel expand/collapse, H1 marker, auto-open, simulated login) in localStorage across reloads.
- [ ] [Internal] 🛡️ Hardened debug hook calls with optional-chaining guards so stripped production builds do not throw.
- [ ] [Internal] 🩹 Removed destination-info collapse state and kept modal content always expanded.
- [ ] [Internal] 🧼 Added compatibility cleanup for legacy destination-info localStorage/view payload data.
