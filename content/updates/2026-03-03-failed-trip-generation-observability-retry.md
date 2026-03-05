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
- [ ] [Internal] 🧮 Admin trips now includes richer table filters, customizable columns, and relative-time timestamp context for faster incident triage.
- [ ] [Internal] 🧾 Admin trip drawer diagnostics now surface retry counters, attempt timeline metadata, and expanded model/provider/request details.
- [ ] [Internal] 🧭 Admin audit filters now include named action groups plus in-menu select/deselect controls and complete audit/terms label mappings.
- [x] [Improved] 🧭 Queue-claim generation failures now preserve the trip record so people can open it and retry instead of losing context.
- [x] [Fixed] 🧾 Trip info now surfaces AI generation state directly in the meta block so status is visible without hunting through details.
- [x] [Fixed] 🇩🇪 Trip list destination flags now refresh reliably after local-to-cloud sync, so country badges stay accurate without a re-login.
- [x] [Fixed] 🔐 Successful sign-in no longer shows a misleading “already signed in” message in the login page or auth modal.
- [x] [Fixed] 📍 Zoom-level marker style switches now avoid duplicate stacked pins on the map.
- [x] [Improved] 🤖 Retry model selectors now group models by provider with logos and a clear “current” pill in trip diagnostics.
- [x] [Fixed] 🔁 Retry attempt history now collapses duplicate in-flight entries and resolves stale running attempts to failed when timeout windows are exceeded.
- [x] [Fixed] 🛑 Failed-generation trips no longer get stuck in an endless “Planning your trip” overlay; loading overlays now follow real generation state.
- [x] [Improved] 🔁 Retrying generation now re-triggers tab feedback (title + favicon animation) so background progress is visible again.
- [x] [Improved] 🧾 Trip diagnostics now show the full captured input snapshot JSON (flow, dates, and payload) for easier replay and debugging.
- [x] [Improved] 🧩 Admin users/trips tables now use subtler, consistent row/column highlight states with corrected sticky-column alignment.
- [ ] [Internal] 📄 Admin trips table now includes the same paged row navigation pattern as admin users (range label + Prev/Next controls).
- [x] [Fixed] 🔍 Audit diff JSON views restored readable token colors and re-enabled full snapshot expansion with scrollable modal content.
- [x] [Fixed] 🧱 Sticky first columns in admin users/trips tables now use reliable offsets, separators, and scroll shadows without layout gaps.
- [ ] [Internal] 🧱 Shared table wrappers now enforce `overscroll-behavior: none`, and admin users/trips grids now combine full-width minimum sizing with content-aware column sizing to prevent sort-time overlap.
- [ ] [Internal] 🧪 Added unit regressions for sticky class generation and shared table wrapper scroll-behavior defaults.
- [x] [Improved] 📑 Audit diff now uses a single “Show full diff” toggle that expands the same side-by-side panes instead of adding extra snapshot boxes.
- [x] [Fixed] 🧭 Checkbox + primary entity columns now behave as one sticky region in selectable admin tables, including correct width locking and horizontal scroll tracking.
- [ ] [Internal] 🧩 Added an admin data-table component group in the design-system playground with sticky/sort/selection examples and documented the table pattern in brand/UI guidelines.
- [ ] [Internal] 🧱 Added structured generation attempt diagnostics service and durable attempt-log RPC/table contracts for richer failure telemetry.
- [ ] [Internal] 🧱 Started async-generation infrastructure rollout with server-side job queue schema, lease RPCs, and typed job service adapters for phased worker cutover.
- [ ] [Internal] ⚙️ Added a flag-gated async generation worker path (edge worker endpoint + scheduled trigger) and queue-claim classic enqueue wiring for server-owned execution rollout.
- [ ] [Internal] ⚙️ Classic create-trip now supports flag-gated async enqueue to the same worker pipeline instead of blocking on client-owned generation completion.
- [ ] [Internal] 🔄 Trip view now polls owner-access DB snapshots while generation is queued/running so server-side async completions appear without manual refresh.
- [ ] [Internal] 🛠️ Removed legacy admin trip-list RPC overloads and hardened generation-state RPC arguments to prevent PostgREST function ambiguity.
- [ ] [Internal] 📡 Added best-effort tab-close abort beacons to improve abort classification during in-flight generation.
- [ ] [Internal] 🧩 Admin trips/users/audit tables now share sticky-column + sorting style primitives for consistent row/column highlighting.
- [ ] [Internal] 🧪 AI benchmark now includes a custom JSON import preset that maps imported generation payloads into the benchmark mask.
- [ ] [Internal] 🔗 Benchmark import payloads now include full generation snapshots to keep benchmark replay and admin retry input shapes aligned.
- [ ] [Internal] 🧪 Added regression coverage for canonical attempt-id alignment and duplicate-attempt display normalization.
