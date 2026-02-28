---
id: rel-2026-02-28-admin-secondary-trip-update-facets
version: v0.58.0
title: "Admin trip update facet labels"
date: 2026-02-28
published_at: 2026-02-28T19:20:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Admin timelines now surface compact secondary trip-update facets while preserving the primary action taxonomy."
---

## Changes
- [ ] [Improved] 🧩 Admin audit and user change timelines now show compact secondary trip-update facets (for example transport/activity/view updates) under the primary `trip.updated` pill.
- [ ] [Improved] 🔎 Admin audit now supports filtering the timeline by trip update facet (for example transport/activity/view changes).
- [ ] [Internal] 📐 Added deterministic secondary-facet derivation logic and regression tests for typed diff keys.
- [ ] [Internal] 🧾 Trip update event writers now persist `secondary_actions` codes so facet rendering is deterministic for new rows and only falls back to key parsing for legacy data.
- [ ] [Internal] 🧬 Added a stable event envelope for trip/failure logs (`event_schema_version`, `event_id`, `event_kind`, `correlation_id`, `causation_id`, `source_surface`) to improve tracing and future schema evolution.
- [ ] [Internal] 🧱 Added structured `domain_events_v1` payload writes on `trip.updated` events for explicit domain sub-event semantics without adding duplicate timeline rows.
- [ ] [Internal] 📚 Expanded logging architecture docs with Phase 2 facet-rendering rules and roadmap status updates.
- [ ] [Internal] ✅ Added a dedicated user/trip logging implementation playbook with required metadata, tests, and DoD checklist to prevent missed audit events.
