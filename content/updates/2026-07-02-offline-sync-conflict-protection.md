---
id: rel-2026-07-02-offline-sync-conflict-protection
version: v0.127.0
title: "Offline sync conflict protection"
date: 2026-07-02
published_at: 2026-07-02T12:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Edits made on another device are no longer overwritten when offline changes sync back."
---

## Changes
- [x] [Fixed] 🔀 Edits made on another device are no longer silently overwritten when your offline changes sync back — the newer version wins and your offline copy is kept as a backup.
- [ ] [Internal] Offline replay now skips the remote upsert on conflict, emits a `sync_conflict_preserved` toast event, and guards the local re-save behind an `updatedAt` freshness check.
