---
id: rel-2026-07-03-footer-bottom-gap
version: v0.0.0
title: "Footer sits flush at the bottom"
date: 2026-07-03
published_at: 2026-07-03T16:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Removes the empty band that appeared below the footer on landing pages."
---

## Changes
- [x] [Fixed] 📐 The footer now sits flush at the bottom of landing pages — the empty band that appeared beneath it is gone.
- [ ] [Internal] The footer wrapper forced a 200px min-height (a spacer from when the footer was lazy-mounted); now that the footer renders eagerly it is often shorter, so the reservation showed as an empty band. Removed the wrapper min-height; the loading spacer still reserves height for the SPA-fallback case.
