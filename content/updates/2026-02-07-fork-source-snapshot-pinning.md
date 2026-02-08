---
id: rel-2026-02-07-fork-source-snapshot-pinning
version: v0.7.0
title: "Fork source snapshot pinning"
date: 2026-02-07
published_at: 2026-02-07T23:00:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "✨ Copying shared trips is now safer and clearer: your copied trip keeps a stable source moment, while the original shared trip keeps evolving."
---

## Changes
- [x] [New feature] Copied trips now keep a stable source reference to the exact version you copied from. 📌
- [x] [Improved] Original shared links stay live, so people always see the newest creator updates. 🔄
- [x] [Improved] Example: Alice shares a trip, switches the map to dark mode, Bob copies it, and Alice later switches back. Bob’s source link still opens the dark-mode snapshot he copied from, while the original shared link shows the newest version. 👀
- [x] [Improved] This makes “copy for inspiration” workflows more trustworthy and easier to follow over time.
- [ ] [Internal] Extended trip metadata and shared-link URL helper support for source snapshot version tracking.
