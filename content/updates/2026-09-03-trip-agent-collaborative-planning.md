---
id: rel-2026-09-03-trip-agent-collaborative-planning
version: v0.162.0
title: "Plan together with Trip Agent"
date: 2026-09-03
published_at: 2026-09-03T12:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Trip Agent brings shared, context-aware planning into each trip while keeping every edit under your control."
---

## Changes
- [x] [New feature] 💬 Open a shared AI planning chat directly beside your trip and continue the conversation after reloading.
- [x] [New feature] 📍 Select a city or itinerary item before chatting so Trip Agent understands exactly what you want to discuss.
- [x] [New feature] ✅ Review proposed edits one by one, compare before and after, and apply only the changes you choose.
- [x] [Improved] 🕰️ Approved edits become one undoable trip version, keeping the existing history clear and predictable.
- [x] [Improved] 🛡️ Free accounts start with three server-enforced requests per UTC day, with a clear reset notice when the limit is reached.
- [ ] [Internal] 🔐 Added persistent shared threads, messages, runs, tool records, proposals, prompt versions, quotas, and atomic approval records behind an admin-preview feature flag.
- [ ] [Internal] 🧭 Added allowlisted specialist boundaries for grounded stay and route research, with an explicit unavailable state when Maps grounding is not configured.
- [ ] [Internal] 🧪 Added typed-operation and history-adoption regression coverage plus deterministic server-side validation paths.
