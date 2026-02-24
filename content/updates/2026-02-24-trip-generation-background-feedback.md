---
id: rel-2026-02-24-trip-generation-background-feedback
version: v0.59.0
title: "Trip generation background feedback"
date: 2026-02-24
published_at: 2026-02-24T21:40:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Adds background progress and completion signals so long-running trip generation stays clear even when users switch tabs."
---

## Changes
- [x] [Improved] 🔔 You can now enable optional browser alerts so you get a heads-up when your generated trip is ready.
- [x] [Improved] 🧭 While your tab is in the background, generation now shows clearer progress and completion cues in the tab UI.
- [x] [Fixed] 🏷️ Page titles now stay in sync with the page you are viewing during in-app navigation.
- [x] [Fixed] ✅ Background completion states now reset cleanly when you return to the tab.
- [ ] [Internal] 📊 Added analytics instrumentation for notification prompt choices, permission outcomes, and successful sends.
- [ ] [Internal] 🧪 Added regression coverage for hidden-tab progress feedback and notification support states.
