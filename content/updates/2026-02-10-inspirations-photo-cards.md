---
id: rel-2026-02-10-inspirations-photo-cards
version: v0.35.0
title: "Travel photography now powers inspiration and blog previews"
date: 2026-02-10
published_at: 2026-02-10T07:16:03Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Inspiration and blog cards now use realistic generated travel photography with responsive WebP delivery and blog-specific social previews."
---

## Changes
- [x] [Improved] 📸 Destination cards now show generated travel photos instead of placeholder map blocks.
- [x] [Improved] 🌸 Cherry Blossom Trail now features a realistic Japan spring scene with cherry blossoms, Chureito Pagoda, and Mount Fuji.
- [x] [Improved] 🎉 Festival cards now use realistic event photography for each celebration.
- [x] [Improved] ⚡ Inspiration card hover interactions are now snappier, with smoother motion and fixed image corner clipping.
- [x] [Improved] 🧾 Destination cards now move country info into the footer, while festival cards show flag + location in the subtitle without image pills.
- [x] [Improved] 🖼️ Inspiration card images now load as responsive WebP assets with lazy loading, taller image framing, and a subtler progressive blur/gradient transition into content.
- [x] [Improved] 🔍 Card images now use a subtle scale-down-on-hover motion for a calmer, more immersive feel.
- [x] [Improved] 📰 Blog overview cards now show generated travel photography instead of placeholder color blocks.
- [x] [Improved] 🏞️ Blog article pages now use wide photographic hero headers with responsive WebP sources.
- [x] [Improved] 🔗 Blog post social previews now render article-specific photography with a soft accent tint in Open Graph cards.
- [x] [Fixed] 🧷 Blog OG image endpoints now tolerate HTML-escaped query keys (e.g. `amp;blog_image`) so preview-tool links render the correct image and BLOG pill.
- [ ] [Internal] 🧠 Added a reusable inspiration image style profile and per-card prompt seeds for consistent future generations.
- [ ] [Internal] 🛠️ Added generation tooling (`npm run build:images`) and workflow docs to rebuild inspiration card images from metadata.
- [ ] [Internal] 🤖 Added missing-only blog image generation tooling (`npm run build:blog-images` + `npm run blog:images:jobs`) for new published posts.
- [ ] [Internal] 🧩 Added per-post blog image metadata and prompt seeds for card, header, and vertical OG image variants.
- [ ] [Internal] 🧪 Extended the OG playground to switch between trip/site previews and test blog `blog_image` + `blog_tint` rendering.
- [ ] [Internal] 🔁 Added a release workflow command (`npm run release:prepare`) to generate missing blog images before full build validation.
- [ ] [Internal] 🖼️ Switched blog OG side-panel source assets to JPEG for better renderer compatibility and stable social preview generation.
