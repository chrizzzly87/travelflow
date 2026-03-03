---
id: rel-2026-03-03-failed-trip-generation-observability-retry
version: v0.80.0
title: "Failed Trip Generation Visibility And Retry"
date: 2026-03-03
published_at: 2026-03-03T16:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Failed trip generations are now easier to spot, inspect, and retry on the same trip."
---

## Changes
- [x] [Improved] 🚨 Failed trip generations now stay visible in plan lists and trip screens with clear generation-status badges.
- [x] [Improved] 🧾 Trip details now show richer AI generation diagnostics, including model/provider context and latest failure details.
- [x] [New feature] 🔁 Travelers can retry failed generation directly on the same trip using the default model.
- [x] [Improved] 🗂️ Admin trip table now shows read-only lifecycle/generation pills, while lifecycle and expiration edits moved into the trip drawer.
- [x] [Improved] 🧭 Queue-claim generation failures now preserve the trip record so people can open it and retry instead of losing context.
- [ ] [Internal] 🧱 Added structured generation attempt diagnostics service and durable attempt-log RPC/table contracts for richer failure telemetry.
- [ ] [Internal] 📡 Added best-effort tab-close abort beacons to improve abort classification during in-flight generation.
