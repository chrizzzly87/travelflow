---
id: rel-2026-02-25-site-og-single-renderer-parity
version: v0.63.0
title: "Site OG single-renderer parity"
date: 2026-02-25
published_at: 2026-02-25T15:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Pre-generated site Open Graph images now use the exact same renderer as live OG responses for consistent fonts and layout."
---

## Changes
- [x] [Fixed] 🖼️ Static social preview cards now match live previews in typography, spacing, and footer layout so previews look consistent everywhere.
- [ ] [Internal] 🧩 Replaced static SVG conversion with a Deno batch pass that calls the same OG image renderer used by live requests, and removed the legacy static renderer path.
- [ ] [Internal] 🧱 Bumped the static OG template revision to force a one-time regeneration so older mismatched image assets are replaced.
