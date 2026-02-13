---
id: rel-2026-02-09-nav-breakpoints-lazy-db
version: v0.24.0
title: "Navigation spacing fix & faster marketing page loads"
date: 2026-02-09
published_at: 2026-02-09T22:10:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Fixed cramped navigation on medium screens and eliminated unnecessary database calls on marketing pages."
---

## Changes
- [x] [Fixed] 🧭 Navigation items no longer overlap the logo on medium-width screens (~790px).
- [x] [Improved] ⚡ Marketing pages (homepage, features, blog, etc.) now load faster — database sync is deferred until you open a trip.
- [ ] [Internal] Raised desktop nav breakpoint from md (768px) to lg (1024px) with tighter gap at lg and wider gap at xl.
- [ ] [Internal] Extracted useDbSync hook to run DB bootstrap (session, upload, sync, settings) once per session and only on trip-related routes.
- [ ] [Internal] Skipped initial-mount DB user settings write to prevent unnecessary auth on marketing pages.
