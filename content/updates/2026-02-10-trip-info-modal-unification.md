---
id: rel-2026-02-10-trip-info-modal-unification
version: v0.43.0
title: "Unified trip information modal across desktop and mobile"
date: 2026-02-10
published_at: 2026-02-10T18:16:28Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Desktop and mobile now share one trip information modal, with destination details and trip-source context centralized in a clearer view."
---

## Changes
- [x] [Improved] ℹ️ Added the trip info icon and popup to desktop so desktop and mobile now use the same information modal entry point.
- [x] [Improved] 🗂️ Moved destination info out of the trip content column and into the trip information modal for a cleaner main layout.
- [x] [Improved] 🧾 Redesigned copied-trip source context inside the information modal so fork/source details are easier to read, including a direct source link when available.
- [x] [Fixed] ⌨️ Ensured the trip information modal closes reliably via `ESC` and outside-click behavior across breakpoints.
- [ ] [Internal] 🧹 Removed legacy destination-info open/close persistence from view state and localStorage.
