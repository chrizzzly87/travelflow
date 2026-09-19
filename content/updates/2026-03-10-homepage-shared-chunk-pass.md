---
id: rel-2026-03-10-homepage-shared-chunk-pass
version: v0.0.0
title: "Homepage auth bootstrap now stays off the first-load critical path when possible"
date: 2026-03-10
published_at: 2026-03-10T16:15:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Made homepage auth bootstrap more route-aware and documented that the remaining homepage speed bottleneck is the large shared entry chunk rather than eager profile hydration."
---

## Changes
- [ ] [Internal] 🔐 Non-critical marketing routes now defer auth bootstrap until idle and avoid eager profile hydration unless the route actually renders account details.
- [ ] [Internal] 📊 Captured a follow-up homepage Lighthouse pass showing that the remaining mobile bottleneck is still the shared entry chunk, which keeps the next optimization step focused on bundle decomposition instead of more auth churn.
