---
id: rel-2026-02-25-netlify-deploy-build-efficiency
version: v0.62.0
title: "Netlify deploy build efficiency"
date: 2026-02-25
published_at: 2026-02-25T09:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Preview deploys and repeat page visits are now faster thanks to build output and asset-cache optimizations."
---

## Changes
- [x] [Improved] ⚡ Preview deploy builds now complete faster, so new updates are available sooner.
- [x] [Improved] 🏳️ Language and destination flags now reuse long-lived cached assets for snappier repeat visits.
- [ ] [Internal] 🚀 Added a dedicated Netlify preview build command (`build:netlify`) while keeping full `pnpm build` for production context.
- [ ] [Internal] 🧩 Replaced bundled Flagpack emission with synced public `/flags/4x3` assets and generated local flag CSS to reduce `dist/assets` churn.
- [ ] [Internal] 🧪 Added unit coverage for flag asset sync + CSS generation utilities.
