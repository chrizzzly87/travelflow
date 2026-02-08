---
id: rel-2026-02-07-core-planning-upgrade
version: v0.3.0
title: "Core planning UX and collaboration upgrade"
date: 2026-02-07
published_at: 2026-02-06T22:00:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "You can now save, share, and fine-tune trips with way less friction, so planning feels faster and more in control."
---

## Changes
- [x] [New feature] 🗄️ Added Supabase-backed trip persistence, version history snapshots, and share-link collaboration modes.
- [x] [Improved] 🎨 Refreshed the create-trip card and stabilized the Tailwind-based UI layer.
- [x] [Improved] 🖱️ Removed noisy hover behavior from the horizontal activity lane.
- [x] [Improved] 📅 Auto-fit horizontal timeline zoom when switching from left-right layout to top-bottom layout, so timeline hover space is used more efficiently.
- [x] [Fixed] 📅 Improved date range picker month focus and range highlighting behavior.
- [x] [Fixed] 📅 Ensured itinerary dates follow app locale formatting rules.
- [ ] [Internal] 📚 Added runbook and support docs for Supabase operational troubleshooting.
- [ ] [Internal] 🛡️ Updated Netlify secret scan allowlist for public VITE Supabase browser values.
