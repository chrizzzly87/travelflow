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
- [x] [Improved] 👋 Refined the greeting hero to a cleaner centered style with accent-only greeting text, IPA pronunciation, and a simpler inspiration link with country flag.
- [x] [New feature] 🧾 Added social-style owner and visitor profile summaries with travel stats, bio/location metadata, and a travel footprint block.
- [x] [Improved] 🖼️ Updated profile identity blocks with centered avatar-overlap styling, cleaner spacing, and reduced repetitive copy.
- [x] [New feature] 🔗 Added public profile handles at `/u/:username` with canonical redirect handling for renamed usernames.
- [x] [Improved] ⚙️ Expanded profile settings with username availability/cooldown guidance, public URL preview, bio, and profile visibility defaults.
- [x] [Improved] 🧭 Added “View public profile” shortcuts to account and mobile menus plus kept recent-trip quick access.
- [x] [Improved] 🗺️ Added per-trip public visibility controls and enforced read-only public trip access mode where needed.
- [x] [Improved] 🏳️ Added country flags to visited-country chips and improved profile metadata readability.
- [x] [Improved] 📤 Added a one-click action to share your public profile URL directly from your profile summary.
- [x] [Improved] 🧩 Simplified trip-card controls to reduce visual clutter while keeping open/favorite/pin/visibility actions.
- [x] [Fixed] 🛠️ Fixed the profile settings crash caused by an invalid empty-value gender select option.
- [ ] [Internal] 🗄️ Fixed Supabase SQL function defaults ordering for the trip upsert RPC signature.
- [ ] [Internal] 🧪 Added and updated regression coverage for greeting/name formatting, country-flag derivation, profile sharing action, and public profile behavior.
