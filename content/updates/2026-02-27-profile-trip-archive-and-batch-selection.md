---
id: rel-2026-02-27-profile-trip-archive-and-batch-selection
version: v0.67.0
title: "Profile trip archive controls and batch selection"
date: 2026-02-27
published_at: 2026-02-27T20:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Profile now supports hover-based multi-select actions, public-only preview filtering, clearer hidden/private states, and Sonner-based archive/history progress feedback."
---

## Changes
- [x] [Improved] 🧹 Added trip archive actions directly on your profile cards so you can remove plans without opening the planner first.
- [x] [New feature] ✅ Added hover-based trip selection with batch actions for archive, favorite toggles, and public/private visibility updates.
- [x] [Improved] 👀 Made hidden trips easier to spot with a dedicated badge and dimmed card treatment across profile cards.
- [x] [Improved] 🗺️ Updated trip map previews to a standard map style with clearer route pins/legs and improved aspect ratio framing.
- [x] [Improved] 🔎 Added a profile-only “Show only public” toggle near trip tabs so you can preview your public profile visibility from private mode.
- [x] [Improved] ⌨️ Added keyboard support for batch archive (`Delete`/`Backspace`) and quick selection reset (`Esc`), with input-focus safety guards.
- [x] [Improved] ♻️ Unified trip archive behavior across profile and My Trips so both surfaces use the same soft-delete flow.
- [x] [Improved] 🔔 Standardized profile and trip history feedback on bottom-right Sonner toasts with in-progress, success, and error states.
- [ ] [Internal] 🗃️ Added DB-backed user trip archive event logging and archive RPC coverage for durable recovery/audit context.
- [ ] [Internal] 🧪 Added regression coverage for profile archive controls, multi-select quick actions, and card-level hidden/selection states.
- [ ] [Internal] 📚 Added a follow-up open issue spec for trip collections/folders (default + custom organization model).
- [ ] [Internal] 🧭 Added a follow-up open issue for canonical trip source attribution and a system catalog owner model.
