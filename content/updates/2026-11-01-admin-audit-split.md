---
id: rel-2026-11-01-admin-audit-split
version: v0.215.0
title: "Audit log screen restructure"
date: 2026-11-01
published_at: 2026-11-01T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The admin audit log screen is split into a state hook, a pure model and focused components, and its timeline uses the shared admin table."
---

## Changes
- [ ] [Internal] 🧭 The audit log timeline now renders on the shared admin table and can be sorted by When, Actor, Action or Target (newest first stays the default; the choice lives in the URL).
- [ ] [Internal] 🧩 Split the audit log page into a reducer-backed state hook, a data hook, an actions hook and focused filter bar, table, entry, user and trip sheet components under `components/admin/audit/`.
- [ ] [Internal] 🧮 Moved the audit log's parsing, filtering, sorting, paging, undo rules and labels into pure model modules with unit tests; the page offset and selection are now derived on render instead of being corrected by effects.
- [ ] [Internal] 🧪 Added reducer and model unit tests plus a browser test covering the filter, sort, open-sheet and export flows.
