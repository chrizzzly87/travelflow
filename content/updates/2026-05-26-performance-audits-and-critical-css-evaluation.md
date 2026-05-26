---
id: rel-2026-05-26-performance-audits-and-critical-css-evaluation
version: v0.117.0
title: "Performance Audits and Critical CSS Evaluation"
date: 2026-05-26
published_at: 2026-05-26T17:30:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Applied critical LCP deferral, dynamic font loading optimizations, and below-the-fold rendering constraints."
---

## Changes
- [x] [Improved] ⚡ Deferred early access, language suggestion, translation notice, and cookie consent banners to mount only on explicit user interactions (scroll, keydown, touch, mousedown) to eliminate LCP delay.
- [x] [Improved] 🔤 Dynamic language-specific font preloading to load Cyrillic and Vazirmatn full fonts for Cyrillic/Arabic languages, and Latin subsets otherwise.
- [x] [Improved] 🏎️ Integrated below-the-fold content-visibility and layout constraints to optimize page rendering times.
- [ ] [Internal] 🧪 Evaluated build-time critical CSS generators and created an automated Lighthouse performance CLI runner script.
