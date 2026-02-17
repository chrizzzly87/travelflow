---
id: rel-2026-02-11-og-playground-stability-and-controls
version: v0.43.0
title: "Image delivery optimization and OG playground stability"
date: 2026-02-11
published_at: 2026-02-17T20:02:10Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Faster blog and inspiration image delivery plus internal OG playground reliability and usability improvements."
---

## Changes
- [x] [Improved] ⚡ Blog cards and post headers now use build-time optimized responsive images (`480/768/1024/1536`) to reduce payload size and improve load speed.
- [x] [Improved] 🖼️ Inspiration cards now use the same build-time responsive image pipeline (`480/768/1024/1536`) for faster loading on mobile and desktop.
- [ ] [Internal] 🧠 Image build scripts are now incremental by default and skip generation when source files already exist, keeping repeated deploy builds fast.
- [ ] [Internal] 📝 Added a full npm script reference to the README so all `npm run` commands are documented in one place.
- [ ] [Internal] 🧯 Fixed a client-side initialization crash in `/api/og/playground` that blocked preview image rendering and sample URL output.
- [ ] [Internal] 🧭 Reorganized the playground form into clear sections (Endpoint, Shared Overrides, Trip Source & Stats, Blog Image Controls).
- [ ] [Internal] 🎚️ Updated endpoint switching to hide non-applicable control groups so only relevant fields are shown.
- [ ] [Internal] 🩹 Fixed an edge runtime crash in the playground template by replacing raw inline backticks with safe HTML code tags.
- [ ] [Internal] 🧼 Removed the long default blog test URL block and softened section-heading weight for cleaner visual hierarchy.
- [ ] [Internal] 🧾 Moved site metadata into Shared Overrides and aligned field order to match design (`pill`, `title`, `description`, `footer path`).
- [ ] [Internal] 🌈 Set site-mode tint defaults to the blog baseline (enabled with 60 intensity) and strengthened tint gradient stops in `/api/og/site`.
- [ ] [Internal] 🧱 Enforced mode hiding with `hidden` + explicit mode-sync display toggles so Site OG never shows trip-only controls, including first render.
- [ ] [Internal] 🎨 Aligned `/api/og/trip` canvas background to the same gradient used by `/api/og/site`.
- [ ] [Internal] 🔐 Expanded Netlify `SECRETS_SCAN_OMIT_KEYS` to include newly introduced provider/admin environment keys for deploy-time secret scanning.
