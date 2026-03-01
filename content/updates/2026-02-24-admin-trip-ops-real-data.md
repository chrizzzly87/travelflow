---
id: rel-2026-02-24-admin-trip-ops-real-data
version: v0.57.0
title: "Admin trips real-data recovery and action controls"
date: 2026-02-24
published_at: 2026-02-24T12:55:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Admin overview and trip operations now stay on live records, with expanded trip actions in both the table and side panel."
---

## Changes
- [ ] [Fixed] 🧭 Admin overview and trip controls now stay connected to live backend records on production runtime.
- [ ] [Improved] 🛠️ Added per-trip admin actions in the trips table: preview, duplicate, transfer owner, JSON export, soft delete, and hard delete.
- [ ] [Improved] 🗂️ Added matching trip action workflows in the side panel, including owner transfer controls near owner context.
- [ ] [Improved] 🧾 Added a user change-log section in the admin user details drawer with timestamped actions and before/after field diffs.
- [ ] [Improved] 🛰️ Expanded the admin audit timeline to include user-originated profile edits and trip archive actions.
- [ ] [Improved] 📄 Added admin log table caps and paging controls (latest 20 in user drawer, 50 per page in global audit) plus actor filters for admin-vs-user activity.
- [ ] [Improved] 🚨 Added admin workspace data-source banners that explain active debug/mock mode and cached fallback reasons.
- [ ] [Fixed] 🧑‍💼 Admin workspace now prefers your real signed-in session over dev-bypass identity when one is available.
- [ ] [Improved] 🪪 Admin sidebar account button now uses the signed-in user identity label and hides recent-trip shortcuts in admin-only dropdowns.
- [ ] [Improved] 👤 Account dropdown buttons now consistently prioritize username handles, and avatar chips now use profile name initials when available.
- [ ] [Fixed] 🧹 Profile trip list now re-syncs from owned DB trips on load and after archive failures to avoid stale non-owned trip actions.
- [ ] [Fixed] 🧷 Simulated-login trip sync now treats mixed-provider sessions (email + anonymous identities) as real accounts, preventing local foreign trip bleed-through.
- [ ] [Fixed] 🧼 Simulated-login debug mode now auto-disables when a real signed-in session is detected, preventing foreign local-trip merges.
- [ ] [Fixed] 🛡️ Trip pages no longer store read-only/public/admin-fallback trips in personal local trip storage, preventing cross-user trip bleed into profile.
- [ ] [Fixed] 🔒 Authenticated profile sync now always replaces local trip cache from owned DB trips, even when access identity hydration is temporarily incomplete.
- [ ] [Improved] 🔐 Anonymous-to-registered sign-ins now use one-time ownership claims that transfer trips and user event history to the signed-in account.
- [ ] [Improved] 🧾 Added anonymous-claim lifecycle storage and maintenance jobs so stale claims expire and claimed anonymous sessions can be purged safely.
- [ ] [Improved] 🚫 Failed user archive attempts are now persisted as user-change events and shown in admin audit timelines with failure details.
- [ ] [Fixed] 🔄 Login callback processing now resolves anonymous ownership claims before queued trip generation claims.
- [ ] [Improved] 🔎 Trip info now shows owner context so read-only/public/admin-fallback views clearly indicate who owns the trip.
- [ ] [Improved] 🪪 Trip info modal now includes an admin-only debug block with owner username/email/UUID and access source for incident tracing.
- [ ] [Improved] 🧾 Trip version commits now emit user change events so itinerary edits show up in admin user logs and the global audit timeline.
- [ ] [Improved] 🧭 User trip update logs now include timeline-level change details (added/deleted items, transport mode changes, and changed fields) for clearer audit forensics.
- [ ] [Improved] 🗺️ Visual-only trip edits (for example map view/timeline layout changes) now appear as concrete before/after diffs in user logs instead of “No field diff recorded.”
- [ ] [Fixed] 🧩 User-change diff rendering now ignores misleading after-only metadata fields, so audit entries align with what was actually edited.
- [ ] [Improved] 🔍 Admin audit and user-change entries now include a “Show complete diff” modal with side-by-side JSON snapshot compare and line-level highlights.
- [ ] [Improved] 🧩 Full diff modals now include saved view-settings snapshots alongside trip data so visual-setting updates are visible in complete diffs.
- [ ] [Improved] 🎯 Diff modal now defaults to focused change context with collapsible unchanged blocks, plus expandable full before/after JSON panes with synced scrolling.
- [ ] [Improved] 🎨 JSON diff rendering now uses clearer syntax highlighting for faster scan of key/value changes.
- [ ] [Fixed] 🧾 Removed verbose metadata panels from admin audit/user-change rows to reduce noise and keep change timelines focused.
- [ ] [Fixed] 🚫 Trip creation-limit checks no longer create anonymous DB accounts during read-only eligibility checks.
- [ ] [Fixed] 🧯 Added a safe auth-context fallback so rare route recovery states no longer crash with “useAuthContext must be used within AuthProvider.”
- [ ] [Improved] ➕ Profile now keeps the top-right navigation “Create Trip” action visible for signed-in users on `/profile` for consistent access.
- [ ] [Improved] 🧱 Admin audit table now supports column resize handles, column visibility toggles, and wider default space for `Diff & details` so dense rows stay readable.
- [ ] [Improved] ⏱️ Admin audit filters now include `Last 24 hours`, `Last 7 days`, `Last 30 days`, `All time`, and a custom date-range picker for faster incident slicing.
- [ ] [Improved] 📤 Admin replay export now supports full-filter exports, selected-row exports, and single-row exports directly from table row actions.
- [ ] [Improved] 🔁 Added confirm-based undo actions in admin audit rows for supported user-originated changes (`trip.updated`, `trip.archived`, `profile.updated`) with new audit entries for each revert.
- [ ] [Improved] 🔔 Replay export and undo success paths now use app toasts instead of persistent top-page banners.
- [x] [Improved] ✉️ Login now better supports saved email autofill with stronger form accessibility labeling.
- [ ] [Internal] 🧪 Added regression coverage for the admin mock-mode guard to prevent production mock-data leakage.
- [ ] [Internal] 🗃️ Added DB-backed profile user-event capture and a unified admin query path for user change logs.
- [ ] [Internal] 🧱 Introduced typed `timeline_diff_v1` metadata (with compatibility fallback) for trip update event rendering and future schema evolution.
- [ ] [Internal] 📐 Added a dedicated timeline diff event contract doc and regression tests that enforce v1-only writes with legacy-read fallback precedence.
- [ ] [Internal] 🧭 Added typed secondary trip-update facets (`secondary_action_codes`) for transport/activity/segment/city/date/visibility operations and expanded timeline-control diff coverage (`Timeline mode`, `Timeline layout`, `Zoomed in`).
- [ ] [Internal] 🏷️ Admin audit and user drawer now render typed secondary facet chips for `trip.updated` rows while keeping the primary action pill compact.
- [ ] [Internal] 🧼 Retired legacy `timeline_diff` read fallback so admin/user timeline parsing now uses `timeline_diff_v1` exclusively.
- [ ] [Internal] 🧬 Added per-operation correlation IDs to trip and failure event metadata for easier cross-table incident tracing.
- [ ] [Internal] 🔗 Correlation IDs now follow deterministic conventions for upsert/version events and archive flows now preserve caller-provided correlation IDs.
- [ ] [Internal] 🧾 Client fallback event writers now add the full immutable event envelope (`event_schema_version`, `event_id`, `event_kind`, `correlation_id`, `causation_id`, `source_surface`) for parity with DB event writers.
- [ ] [Internal] 🧷 Immutable fallback event envelopes now include actor/target IDs and a redaction policy field for complete Phase 3 metadata.
- [ ] [Internal] 📦 Admin audit replay export now runs via a server endpoint and persists `admin.audit.export` entries, while still downloading `admin_forensics_replay_v1` bundles with correlation-group summaries and redaction-aware payload shaping.
- [ ] [Internal] 🧩 User change-table diff rows now use typed structured-value formatters (instead of raw JSON blobs) across admin audit and user drawer surfaces.
- [ ] [Internal] 🧪 Hardened long-running admin browser tests with explicit timeouts to stabilize `pnpm test:core` runs in CI-like load.
- [ ] [Internal] 🧱 Added admin snapshot lookup RPC for version-based trip updates so full diff modals resolve canonical before/after snapshots on demand.
- [ ] [Internal] 🧹 Added admin reset/cleanup SQL controls to purge anonymous users and clear audit/user log tables for clean test passes.
- [ ] [Internal] 📚 Added architecture docs for auth/session ownership, profile trip visibility rules, and audit/log event taxonomy.
