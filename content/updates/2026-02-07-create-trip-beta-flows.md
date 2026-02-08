---
id: rel-2026-02-07-create-trip-beta-flows
version: v0.5.0
title: "Create Trip beta flows: Wizard and Surprise Me"
date: 2026-02-07
published_at: 2026-02-07T18:30:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "You now get beta Wizard and Surprise Me planning flows, plus season-aware country guidance and dedicated prompt paths per flow."
---

## Changes
- [x] [New feature] 🤖 Added a tabbed Create Trip experience with Classic, Wizard (Beta), and Surprise Me (Beta) flows.
- [x] [New feature] 🤖 Added dedicated generation prompts per flow, including a wizard-specific and surprise-specific itinerary prompt.
- [x] [Improved] 🌍 Added season-aware country metadata and reusable country tag UI to keep destination selection consistent across flows.
- [x] [Improved] 🗓️ Added a simplified Surprise Me setup with month-plus-weeks (default) or explicit start/end dates.
- [x] [Fixed] 📅 Corrected date picker anchoring so the calendar opens aligned with its input.
- [x] [Fixed] ✅ Moved country autocomplete dropdowns to viewport-anchored overlays so they no longer render behind or under the footer.
- [x] [Fixed] ⚡ Removed first-open dropdown jump by measuring anchor position before rendering portal overlays.
- [x] [Fixed] 🧪 Repaired hero background shader compilation so WebGL rendering no longer fails with invalid program errors.
- [x] [Fixed] ⚡ Temporarily disabled the WebGL hero background and switched to a static gradient fallback to improve perceived performance.
- [ ] [Internal] 🧪 Continue refining beta flow UX, scoring logic, and recommendation presentation before moving out of beta.
