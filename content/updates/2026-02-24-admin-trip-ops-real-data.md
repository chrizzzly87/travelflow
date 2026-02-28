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
- [ ] [Fixed] 🚫 Trip creation-limit checks no longer create anonymous DB accounts during read-only eligibility checks.
- [x] [Improved] ✉️ Login now better supports saved email autofill with stronger form accessibility labeling.
- [ ] [Internal] 🧪 Added regression coverage for the admin mock-mode guard to prevent production mock-data leakage.
- [ ] [Internal] 🗃️ Added DB-backed profile user-event capture and a unified admin query path for user change logs.
