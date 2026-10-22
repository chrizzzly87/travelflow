---
id: rel-2026-10-21-og-image-delivery
version: v0.208.0
title: "Reliable sharing images"
date: 2026-10-21
published_at: 2026-10-21T15:29:43Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Sharing images load reliably and stay separate from animated videos."
---

## Changes
- [x] [Fixed] 🖼️ Sharing images now finish loading before delivery, and video posters have a dedicated image link.
- [ ] [Internal] 🧩 Initialize the pinned Edge image runtime during requests, buffer and validate PNG output with a deadline, and normalize cache headers.
- [ ] [Fixed] 🔗 Normalize copied HTML-escaped media links, preserve media-revision checks, and classify poster images correctly in admin.
- [ ] [Improved] 💾 Reuse image cache URLs in the OG playground and show loading failures explicitly without starting video renders.
- [x] [Fixed] 📐 Long trip titles keep their sharing card’s statistics and footer readable.
- [ ] [Improved] 🖼️ Keep playground preview panels at their natural height so loaded images remain visible.
- [x] [Fixed] 🔗 Allow LinkedIn to fetch shared trip previews and their images.
