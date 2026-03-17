---
id: rel-2026-03-16-shared-trip-view-metadata-persistence
version: v0.97.0
title: "Shared trips now reopen in the last planner view you chose"
date: 2026-03-16
published_at: 2026-03-17T15:19:26Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Shared trips now reopen in the latest calendar or timeline view, orientation, and zoom level you last shared."
---

## Changes
- [x] [Improved] 🧭 Shared trips now reopen in the latest planner view you chose, including calendar versus timeline mode, horizontal versus vertical layout, and your exact manual zoom level.
- [x] [Improved] 🔗 Existing share links now refresh their saved planner view when you reshare, so you do not need a brand-new link just to preserve how the trip opens.
- [ ] [Internal] 🗃️ Stored share-view defaults in share metadata, aligned the schema file with the latest shared audit-log function contract, and added regression coverage for owner reshare sync plus shared-route replay.
