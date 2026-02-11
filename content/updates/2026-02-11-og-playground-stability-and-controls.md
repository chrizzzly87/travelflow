---
id: rel-2026-02-11-og-playground-stability-and-controls
version: v0.46.0
title: "OG playground stability and control clarity"
date: 2026-02-11
published_at: 2026-02-11T06:33:16Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Internal OG playground reliability and usability update for faster preview debugging."
---

## Changes
- [ ] [Internal] 🧯 Fixed a client-side initialization crash in `/api/og/playground` that blocked preview image rendering and sample URL output.
- [ ] [Internal] 🧭 Reorganized the playground form into clear sections (Endpoint, Shared Overrides, Trip Source & Stats, Blog Image Controls).
- [ ] [Internal] 🎚️ Updated endpoint switching to hide non-applicable control groups so only relevant fields are shown.
- [ ] [Internal] 🩹 Fixed an edge runtime crash in the playground template by replacing raw inline backticks with safe HTML code tags.
- [ ] [Internal] 🧼 Removed the long default blog test URL block and softened section-heading weight for cleaner visual hierarchy.
- [ ] [Internal] 🧾 Moved site metadata into Shared Overrides and aligned field order to match design (`pill`, `title`, `description`, `footer path`).
- [ ] [Internal] 🌈 Set site-mode tint defaults to the blog baseline (enabled with 60 intensity) and strengthened tint gradient stops in `/api/og/site`.
- [ ] [Internal] 🧱 Enforced mode hiding with both `hidden` and `display:none` so Site OG never shows trip-only controls, including first render and mode-switch sync.
- [ ] [Internal] 🎨 Aligned `/api/og/trip` canvas background to the same gradient used by `/api/og/site`.
