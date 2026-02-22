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
- [x] [Improved] 🫧 Shared image and text elements now blend with a short crossfade during the move so page swaps are less visually abrupt.
- [x] [Improved] 🧭 First-run blog transitions now wait for destination layout readiness to reduce misplaced shared elements on initial navigation.
- [x] [Improved] 🖼️ Blog list cards and article headers now use the same underlying photo source for each post.
- [ ] [Internal] 🧩 Added feature-detected transition wiring, tuned shared-element animation rules, and regression coverage for transition helpers and media mapping.
