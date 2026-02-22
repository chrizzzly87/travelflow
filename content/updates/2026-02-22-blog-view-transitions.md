---
id: rel-2026-02-22-blog-view-transitions
version: v0.56.0
title: "Blog list/detail shared view transitions"
date: 2026-02-22
published_at: 2026-02-22T09:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Adds smooth shared-element transitions between the blog list and article pages with graceful fallback on unsupported browsers."
---

## Changes
- [x] [Improved] 🎞️ Opening a blog article now smoothly morphs the card image, headline, and preview text into the full article header.
- [x] [Improved] ↩️ Returning to the blog list now preserves the same visual continuity, including browser back navigation on supported browsers.
- [x] [Improved] ✨ Transition choreography now keeps headline sizing more consistent, fades metadata quickly, and dissolves the temporary card layer faster.
- [x] [Improved] 🖼️ Shared blog images now stay fully opaque during movement so reverse transitions no longer flash through a gray blend.
- [x] [Improved] 🧭 Detail-to-list transitions now carry an explicit article target hint and prime the destination layout snapshot for more reliable first-run positioning.
- [x] [Improved] 🧼 Blog transitions now ignore stale card hints when no active transition is running, preventing wrong article images from appearing mid-animation.
- [x] [Improved] 🖼️ Blog list cards and article headers now use the same underlying photo source for each post.
- [ ] [Internal] 🧩 Added feature-detected transition wiring, tuned shared-element animation rules, and regression coverage for transition helpers and media mapping.
