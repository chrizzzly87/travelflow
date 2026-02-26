---
id: rel-2026-02-25-supabase-outage-resilience
version: v0.65.0
title: "Supabase outage resilience and offline trip replay"
date: 2026-02-25
published_at: 2026-02-25T18:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Planner routes now stay usable during Supabase outages, with queued local edits that replay automatically after reconnect."
---

## Changes
- [x] [Improved] 🛟 Planner routes now keep working in outage scenarios with clear connectivity status feedback instead of hard-failing.
- [x] [Improved] 💾 Owned trip edits now queue locally while offline/degraded and replay automatically when connection recovers.
- [x] [Improved] 🔄 Trip view now surfaces sync progress with a spinner, pending counts, and retry actions for failed replays.
- [x] [Improved] 🆘 Connectivity banners now include cleaner retry messaging (30s reconnect cadence) and quick contact/email support actions during outages.
- [x] [Improved] 🧯 Fixed a Supabase save compatibility edge case that could block trip updates on some database function-overload setups.
- [x] [New feature] 🧪 Added outage simulation controls via debugger actions and `?offline=` URL override support.
- [x] [Improved] 🧭 Trip loading now prefers local snapshots during outages and refreshes from server once connectivity returns.
- [ ] [Internal] 🧱 Added client-side Supabase health monitor, offline queue manager, conflict-backup capture, and reconnect sync orchestrator.
- [ ] [Internal] 🧾 Added bounded client-side Supabase error buffering for post-incident troubleshooting context.
- [ ] [Internal] 🧪 Added regression coverage for health monitor transitions, queue persistence/coalescing, sync retry behavior, and offline route-loader fallbacks.
- [ ] [Internal] 🧪 Added an opt-in Playwright outage suite for periodic checks, including `navigator.onLine` network emulation and forced-outage banner flows.
