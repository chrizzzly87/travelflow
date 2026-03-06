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
- [x] [Fixed] 🚨 Legacy failed trip drafts now correctly show a failed AI-generation status instead of appearing as succeeded.
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
- [ ] [Internal] ⚙️ Added async generation worker infrastructure (edge worker endpoint + scheduled trigger) and queue enqueue wiring for server-owned execution.
- [ ] [Internal] ⚙️ Classic and wizard create-trip submits now enqueue async worker jobs by default, so generation completion is no longer bound to an open browser tab.
- [ ] [Internal] ⚙️ Queue-claim wizard/surprise processing now enqueues the same async worker pipeline with flow-aware prompt metadata.
- [ ] [Internal] ⚙️ Retry now always enqueues server-owned async jobs for the same trip instead of running generation in the browser session.
- [ ] [Internal] ⚙️ Removed client-side async-flow feature flags/fallback branches so all active generation entry points use the worker queue lifecycle.
- [ ] [Internal] 🛠️ Async create-trip now waits for trip-row persistence before attempt logging/enqueue, preventing `Trip not found` races on `trip_generation_attempt_start` and enqueue RPCs.
- [ ] [Internal] 🛠️ Async enqueue now requires a canonical server-logged attempt ID (not optimistic client IDs), preventing false enqueue attempts after failed attempt-start RPCs.
- [ ] [Internal] 🛠️ Retry flow now also requires a canonical server-logged attempt ID before enqueue, preventing first-click retry flash-fail behavior on stale optimistic attempt IDs.
- [ ] [Internal] 🛠️ Trip polling now ignores stale remote failed snapshots while a newer local queued/running retry is in flight, preventing retry-state flicker regressions.
- [ ] [Internal] 🛠️ Trip retry actions now use a strict in-flight mutex so one click cannot create duplicate attempt-start requests before UI state settles.
- [ ] [Internal] ⚙️ Scheduled worker triggers now hand off processing to a protected background function, avoiding 30s scheduled-function limits and keeping queued jobs draining reliably.
- [ ] [Internal] 🛠️ Netlify worker triggers now use deploy-safe function handlers (`handler` exports + HTTP bridge) so both cron and background worker functions are bundled and callable in production.
- [ ] [Internal] ⚙️ Async worker provider timeout now stays within edge-runtime-safe bounds (short default + capped max) so jobs fail deterministically instead of lingering in leased/queued limbo.
- [x] [Improved] 🤖 Default generation + retry model baseline now uses OpenAI GPT-5.4 across create-trip and retry entry points.
- [ ] [Internal] 🛠️ Queue-claim RPC now rejects already-claimed requests instead of returning stale rows, preventing duplicate trip generation from repeated claim calls.
- [ ] [Internal] 🛠️ Admin trip-list RPC fallback now also handles PostgREST overload-selection errors (`best candidate function`) for stable table loading during mixed-schema rollouts.
- [ ] [Internal] 🛠️ Worker success merge now preserves existing trip preference fields (favorites and map/style settings) instead of resetting them to generated defaults.
- [ ] [Internal] 🛠️ Worker now logs non-2xx attempt/job RPC responses with explicit error labels so completion/failure bookkeeping issues are visible in run output.
- [x] [Fixed] 🧭 Create-trip generation now ensures an anonymous DB session before enqueueing worker jobs, preventing immediate enqueue failures for signed-out users.
- [x] [Fixed] 🔐 Create-trip now redirects to login with the current draft path preserved when no DB session is available, avoiding dead enqueue attempts in strict-auth environments.
- [x] [Improved] 🧭 Signed-out planners can save a trip draft and open the trip page first; generation starts after sign-in via a claim link from the trip status banner.
- [ ] [Internal] 🔔 Background auth-claim generation now registers a global completion watcher that shows success/failure toast actions with a direct link back to the trip.
- [ ] [Internal] 🧯 Admin trip diagnostics now includes queue/dead-letter job history (state, retry budget, latest worker error) for faster worker incident triage.
- [ ] [Internal] 🧯 Admin trip diagnostics now supports one-click requeue for dead/failed worker jobs to speed up manual recovery during incidents.
- [ ] [Internal] 🔄 Trip view now polls owner-access DB snapshots while generation is queued/running so server-side async completions appear without manual refresh.
- [ ] [Internal] 🛠️ Trip-view polling now stops on derived terminal states (including stale-running timeout fallback) so failed banners do not keep background polling alive.
- [ ] [Internal] 🛠️ High-frequency trip polling now skips owner-profile lookup payloads to avoid duplicate `profiles` requests while generation is active.
- [ ] [Internal] 🛠️ Polled remote trip snapshots now preserve server `updatedAt` when cached locally, preventing client sync feedback loops that spam repeated `upsert_trip`/trip-fetch requests.
- [ ] [Internal] 🛠️ Tab-feedback favicon/title animation now stays active through queued/running generation and only resolves on terminal success/failure, including retry handoffs.
- [ ] [Internal] 🛠️ Local trip-cache writes now gracefully prune oldest local entries when browser storage quota is exceeded, preventing “Failed to replace trips in storage” hard-fail loops during reload/sync.
- [x] [Improved] 🧭 Create Trip now focuses on classic + wizard flows, with obsolete lab routes retired and a guided wizard CTA at the bottom of the planner.
- [x] [Improved] 🧪 Trip diagnostics now show the execution mode (`async_worker` plus legacy sync markers), making tab-independent rollout status directly visible.
- [ ] [Internal] 🧹 Removed detached legacy create-trip lab components/tests so retired flows no longer add maintenance surface.
- [ ] [Internal] 🛠️ Removed legacy admin trip-list RPC overloads and hardened generation-state RPC arguments to prevent PostgREST function ambiguity.
- [ ] [Internal] 🛠️ Async enqueue RPC now resolves attempt uniqueness via a named table constraint, preventing ambiguous `attempt_id` failures during retry/job enqueue calls.
- [ ] [Internal] 📡 Added best-effort tab-close abort beacons to improve abort classification during in-flight generation.
- [ ] [Internal] 🧩 Admin trips/users/audit tables now share sticky-column + sorting style primitives for consistent row/column highlighting.
- [ ] [Internal] 🧪 AI benchmark now includes a custom JSON import preset that maps imported generation payloads into the benchmark mask.
- [ ] [Internal] 🔗 Benchmark import payloads now include full generation snapshots to keep benchmark replay and admin retry input shapes aligned.
- [ ] [Internal] 🧪 Added regression coverage for canonical attempt-id alignment and duplicate-attempt display normalization.
- [ ] [Internal] 🛠️ Worker job claiming now reclaims expired leased jobs, so interrupted runs no longer leave trips permanently stuck in queued/leased states.
- [ ] [Internal] 🛠️ Worker claim RPC failures now return explicit error payloads instead of silent `claimed: 0` responses, improving production incident diagnosis.
- [ ] [Internal] ⚙️ Async worker lease/provider timeout defaults are now tuned for edge-runtime safety to reduce long-lived stuck leases after provider hangs.
- [ ] [Internal] ⚙️ Async enqueue now performs a best-effort authenticated worker kick, and the worker accepts verified user bearer triggers (single-job), reducing stuck queued trips when cron/admin-key wiring drifts.
- [ ] [Internal] 🛠️ Worker now marks stale superseded queue jobs as skipped so old backlog attempts cannot overwrite newer retry attempts for the same trip.
- [ ] [Internal] ⚙️ Async worker lease windows now scale to the runtime-safe provider timeout cap so abandoned leases get reclaimed quickly and retry UX stays responsive.
- [ ] [Internal] ⚙️ Cron/background worker trigger timeouts now allow longer async worker runs, reducing premature trigger aborts on long model responses.
- [ ] [Internal] 🛠️ Retry now preflights server generation state, reuses existing queued/running attempts, and force-kicks the worker instead of creating duplicate queued retries.
- [ ] [Internal] 🛠️ Client-side stale-state fallback no longer auto-flips async-worker queued/running attempts to failed before the worker writes a terminal state.
- [ ] [Internal] 🛠️ Queue claiming now prefers newest jobs within the same priority/run window, so repeated retries process the latest attempt first.
- [ ] [Internal] 🛠️ Worker supersede checks now compare attempt lifecycle state + start-time ordering instead of raw attempt-ID mismatch, preventing newer retries from being incorrectly skipped when trip metadata is stale.
- [ ] [Internal] 🛠️ Async retry/create enqueue now verifies canonical attempt persistence (with DB upsert fallback) before queueing, reducing stale-latest-attempt races that left trips stuck in queued state.
- [ ] [Internal] ⚙️ Trip view now periodically re-kicks the async worker while queued/running owner attempts are open, reducing “queued but not started yet” delays when the initial enqueue trigger is missed.
- [ ] [Internal] 🛠️ Async enqueue now treats terminal queue-row responses (`failed`/`dead`/`completed`) as enqueue failures, preventing false “queued” UI states when no runnable job exists.
- [ ] [Internal] 🛠️ Trip view now detects stale async attempts with no active queue job and marks them failed with explicit diagnostics, preventing endless queued overlays after refreshes.
- [ ] [Internal] 🛠️ Visual commit tracking now ignores non-manual zoom jitter updates, reducing repeated `upsert_trip`/trip-read loops on already-finished trips.
- [ ] [Internal] 🛠️ Retry stale-job checks now treat only truly active queue jobs as in-flight (queued-ready or unexpired lease), preventing first-click retry no-op flashes on expired/stale leases.
- [ ] [Internal] 🛠️ Trip polling now accepts remote terminal state after a hard-stale local in-flight window, self-healing stuck local queued snapshots that were newer but never actually runnable.
- [ ] [Internal] 🛠️ Trip route view-settings forwarding now deduplicates unchanged payloads and stabilizes callback identity, reducing repeated `user_settings` upserts during idle trip viewing.
- [ ] [Internal] 🛠️ DB bootstrap upload now skips stale local queued/running snapshots when remote generation is already terminal/newer, preventing completed worker trips from being overwritten back to queued.
- [x] [Improved] 🎨 Async worker-generated city chips now use the same stronger palette depth as planner-generated trips, avoiding washed-out timeline colors.
