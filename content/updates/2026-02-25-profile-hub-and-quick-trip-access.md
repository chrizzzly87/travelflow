---
id: rel-2026-02-25-profile-hub-and-quick-trip-access
version: v0.58.0
title: "Profile hub with highlights and quick trip access"
date: 2026-02-25
published_at: 2026-02-25T21:10:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Profile now ships as a full hub with animated greeting hero, public handles, social-style stats, and public trip visibility controls."
---

## Changes
- [x] [Improved] 🎨 Rebuilt the profile page into the same base content grid as navigation and removed the old boxed-shell layout.
- [x] [New feature] 👋 Added a large animated multilingual greeting hero with transliteration, phonetics, and a direct inspirations jump per reload.
- [x] [New feature] 🧾 Added social-style owner and visitor profile summaries with travel stats, bio/location metadata, and a travel footprint block.
- [x] [New feature] 🔗 Added public profile handles at `/u/:username` with canonical redirect handling for renamed usernames.
- [x] [Improved] ⚙️ Expanded profile settings with username availability/cooldown guidance, public URL preview, bio, and profile visibility defaults.
- [x] [Improved] 🧭 Added “View public profile” shortcuts to account and mobile menus plus kept recent-trip quick access.
- [x] [Improved] 🗺️ Added per-trip public visibility controls and enforced read-only public trip access mode where needed.
- [x] [Improved] 🏷️ Added optional creator-handle attribution support for reusable trip preview cards with profile linking capability.
- [ ] [Internal] 🧪 Added and updated regression coverage for public profile routing, creator attribution rendering, settings username checks, and public-read trip behavior.
