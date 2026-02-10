---
id: rel-2026-02-10-inspirations-photo-cards
version: v0.33.0
title: "Inspiration cards now use authentic travel photography"
date: 2026-02-10
published_at: 2026-02-10T04:36:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Inspiration destination and festival cards now use realistic generated travel photos with responsive WebP delivery."
---

## Changes
- [x] [Improved] 📸 Destination cards now show generated travel photos instead of placeholder map blocks.
- [x] [Improved] 🌸 Cherry Blossom Trail now features a realistic Japan spring scene with cherry blossoms, Chureito Pagoda, and Mount Fuji.
- [x] [Improved] 🎉 Festival cards now use realistic event photography for each celebration.
- [x] [Improved] ⚡ Inspiration card hover interactions are now snappier, with smoother motion and fixed image corner clipping.
- [x] [Improved] 🧾 Destination cards now move country info into the footer, while festival cards show flag + location in the subtitle without image pills.
- [x] [Improved] 🖼️ Inspiration card images now load as responsive WebP assets with lazy loading, taller image framing, and a subtler progressive blur/gradient transition into content.
- [x] [Improved] 🔍 Card images now use a subtle scale-down-on-hover motion for a calmer, more immersive feel.
- [ ] [Internal] 🧠 Added a reusable inspiration image style profile and per-card prompt seeds for consistent future generations.
- [ ] [Internal] 🛠️ Added generation tooling (`npm run build:images`) and workflow docs to rebuild inspiration card images from metadata.
