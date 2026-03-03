---
id: rel-2026-03-03-zero-results-route-availability-followup
version: v0.0.0
title: "Route reliability follow-up for ZERO_RESULTS and transport availability"
date: 2026-03-03
published_at: 2026-03-03T10:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Started follow-up work to make route failures more deterministic and reduce noisy fallback behavior."
---

## Changes
- [ ] [Internal] 🧭 Added structured route-failure reason classification to support future leg-level transport availability UX.
- [ ] [Internal] 🧠 Persisted failure reasons in route cache metadata and passed reason context through route-status updates.
- [ ] [Internal] 🔕 Added short-window deduping for repeated route fallback warnings on identical legs/modes.
