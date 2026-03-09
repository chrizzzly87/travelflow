---
id: rel-2026-02-25-supabase-outage-resilience
version: v0.73.0
title: "Supabase outage resilience and offline trip replay"
date: 2026-02-25
published_at: 2026-03-01T09:50:30Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Planner routes now stay usable during Supabase outages, with queued local edits that replay automatically after reconnect."
---

## Changes
- [x] [Improved] 🛟 Planner routes now keep working in outage scenarios with clear connectivity status feedback instead of hard-failing.
- [x] [Improved] 💾 Owned trip edits now queue locally while offline/degraded and replay automatically when connection recovers.
- [x] [Improved] 🔄 Trip view now surfaces sync progress with a spinner, pending counts, and retry actions for failed replays.
- [x] [Improved] 🧾 Change History now clearly marks when the latest edits are still local and not synced yet.
- [x] [Improved] 🆘 Connectivity banners now use clearer offline-vs-service-outage messaging, slimmer mobile spacing, and context-aware support actions.
- [x] [Improved] 🧭 Create Trip now shows outage status directly below navigation to keep planner messaging visible without clutter.
- [x] [Improved] 🚫 Create Trip generation is now disabled while the browser is offline and automatically re-enabled after reconnect.
- [x] [Improved] 📶 A compact global connectivity badge now shows `Offline`, `Syncing...`, and `Online` status across trip flows, with auto-hide after reconnection.
- [x] [Improved] 💡 Global connectivity badge now supports hover/tap details and pulse-ring status indicators for clearer state awareness.
- [x] [Improved] 🧯 Fixed a Supabase save compatibility edge case that could block trip updates on some database function-overload setups.
- [x] [New feature] 🧪 Added outage simulation controls via debugger actions and `?offline=` URL override support.
- [ ] [Internal] 🧪 Added separate browser online/offline debugger overrides so network-offline behavior can be tested independently from forced Supabase degraded/offline modes.
- [x] [Improved] 🧪 On-page debugger is now grouped into clear `Testing`, `Tracking`, and `SEO` tabs for focused QA flows.
- [x] [Improved] 🧪 Debugger tracking-box overlay now starts disabled by default, and testing controls include a clearer `Set Supabase Normal` reset action.
- [x] [Improved] 🧭 Trip loading now prefers local snapshots during outages and refreshes from server once connectivity returns.
- [ ] [Internal] 🧱 Added client-side Supabase health monitor, offline queue manager, conflict-backup capture, and reconnect sync orchestrator.
- [ ] [Internal] 🧾 Added bounded client-side Supabase error buffering for post-incident troubleshooting context.
- [ ] [Internal] 🧪 Added regression coverage for health monitor transitions, queue persistence/coalescing, sync retry behavior, and offline route-loader fallbacks.
- [ ] [Internal] 🧪 Added an opt-in Playwright outage suite for periodic checks, including `navigator.onLine` network emulation and forced-outage banner flows.
