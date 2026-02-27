---
id: rel-2026-02-27-profile-trip-archive-and-batch-selection
version: v0.67.0
title: "Profile trip archive controls and batch selection"
date: 2026-02-27
published_at: 2026-02-27T20:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Profile now supports single and batch trip archiving with confirmation dialogs and keyboard-aware selection mode."
---

## Changes
- [x] [Improved] 🧹 Added trip archive actions directly on your profile cards so you can remove plans without opening the planner first.
- [x] [New feature] ✅ Added profile selection mode with multi-select checkboxes and a batch archive action for faster cleanup.
- [x] [Improved] ⌨️ Added keyboard support for batch archive (`Delete`/`Backspace`) and quick exit from selection mode (`Esc`), with confirmation prompts and input-focus safety guards.
- [x] [Improved] ♻️ Unified trip archive behavior across profile and My Trips so both surfaces use the same soft-delete flow.
- [ ] [Internal] 🗃️ Added DB-backed user trip archive event logging and archive RPC coverage for durable recovery/audit context.
- [ ] [Internal] 🧪 Added regression coverage for profile archive controls, selection mode, and card-level archive/selection actions.
- [ ] [Internal] 📚 Added a follow-up open issue spec for trip collections/folders (default + custom organization model).
