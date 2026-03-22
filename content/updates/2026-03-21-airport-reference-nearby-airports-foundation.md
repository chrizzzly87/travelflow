---
id: rel-2026-03-21-airport-reference-nearby-airports-foundation
version: v0.0.0
title: "Airport reference and nearby-airports foundation"
date: 2026-03-21
published_at: 2026-03-21T16:45:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Adds a generated commercial-airport reference snapshot, nearby-airport lookup tiers, and a dedicated admin workspace for syncing, bulk editing, map-testing, and fake ticket previews."
---

## Changes
- [ ] [Internal] 🛫 Added a generated commercial-airport snapshot plus metadata and SQL seed so one repo-managed dataset can drive both local fallback lookups and backend seeding.
- [ ] [Internal] 📍 Added shared nearest-airport utilities and a separate `/api/runtime/nearby-airports` edge endpoint that can now filter all commercial airports vs regional passenger airports vs major commercial hubs.
- [ ] [Internal] 🧭 Added a dedicated `/admin/airports` workspace for catalog status, full-table browsing, row editing, and one-click upstream syncs into Supabase.
- [ ] [Internal] 🗺️ Added a Google city search + map-based airport tester in admin so nearby-airport lookups can be checked visually against manual coordinates or runtime location.
- [ ] [Internal] 🎛️ Upgraded the admin airport tester with country scoping, same-country lookup mode, and softer map framing so current location plus nearby airports stay easier to inspect together.
- [ ] [Internal] 🔁 Fixed the admin nearby-airport tester so same-country filtering now refreshes the result list, map, and fake-ticket context together instead of leaving stale cross-country rows behind.
- [ ] [Internal] 🔗 Added URL-backed filter state for the airport admin workspace so catalog filters and nearby-airport tester settings survive refreshes and can auto-restore a prior lookup.
- [ ] [Internal] 🧾 Added a fake digital boarding-pass lab in admin so the nearest commercial airport can be previewed as a realistic ticket artifact for future travel surfaces.
- [ ] [Internal] 🗂️ Added bulk airport editing plus bulk deletes in admin for multi-row airport type, scheduled-service, timezone, and cleanup corrections without leaving the shared airport workspace.
- [ ] [Internal] 🏳️ Swapped the airport country filters to the shared flag-aware country picker and added resizable airport-table columns so the admin workspace reuses the same selection and table ergonomics as other admin tools.
- [ ] [Internal] ✅ Swapped the airport editor’s country field to the same shared flag-aware picker and auto-derived country names so catalog edits cannot drift into mismatched country code/name pairs.
- [ ] [Internal] ➕ Added create and delete flows to the airport editor so admins can manage the catalog rows directly instead of only syncing and editing existing records.
- [ ] [Internal] 🧪 Added regression coverage for airport snapshot generation, distance sorting, the nearby-airports edge route, the new admin airports route, and the admin workspace flows.
